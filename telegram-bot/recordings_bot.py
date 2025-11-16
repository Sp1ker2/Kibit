#!/usr/bin/env python3
"""
Telegram bot for browsing and downloading LiveKit recordings.

The bot connects to the storage server over SSH/NFS and exposes the
`room/user/date` folder hierarchy via inline keyboards. Users can pick any
recording segment and receive it directly in Telegram.

Environment variables:
    TELEGRAM_BOT_TOKEN   – bot token issued by BotFather (required)
    STORAGE_HOST         – storage server host/IP (required)
    STORAGE_USER         – SSH user (default: root)
    STORAGE_PASSWORD     – SSH password (optional if key auth is used)
    STORAGE_KEY_PATH     – path to private key for SSH auth (optional)
    STORAGE_PORT         – SSH port (default: 22)
    RECORDINGS_PATH      – root path with recordings
                           (default: /www/wwwroot/LiveKit/recordings)

Usage:
    $ python3 telegram-bot/recordings_bot.py
"""

from __future__ import annotations

import asyncio
import io
import logging
import os
import posixpath
import stat
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Iterable, List
from urllib.parse import quote, unquote

import paramiko
from paramiko.ssh_exception import SSHException
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.constants import ParseMode
from telegram.ext import Application, CallbackQueryHandler, CommandHandler, ContextTypes, Defaults

logging.basicConfig(
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    level=logging.INFO,
)
LOGGER = logging.getLogger("recordings_bot")

# Callback data helpers ----------------------------------------------------- #


def _encode_callback(prefix: str, value: str) -> str:
    return f"{prefix}:{quote(value, safe='')}"


def _decode_callback(data: str) -> tuple[str, str]:
    if ":" not in data:
        raise ValueError(f"Invalid callback payload: {data!r}")
    prefix, payload = data.split(":", 1)
    return prefix, unquote(payload)


# Storage access ------------------------------------------------------------ #


class StorageError(RuntimeError):
    """Raised when storage operations fail."""


@dataclass(frozen=True)
class StorageConfig:
    host: str
    user: str = "root"
    password: str | None = None
    key_path: str | None = None
    port: int = 22
    recordings_path: str = "/www/wwwroot/LiveKit/recordings"

    @classmethod
    def from_env(cls) -> "StorageConfig":
        host = os.environ.get("STORAGE_HOST")
        if not host:
            raise RuntimeError("STORAGE_HOST environment variable is required")
        user = os.environ.get("STORAGE_USER", "root")
        password = os.environ.get("STORAGE_PASSWORD") or None
        key_path = os.environ.get("STORAGE_KEY_PATH") or None
        port = int(os.environ.get("STORAGE_PORT", "22"))
        recordings_path = os.environ.get(
            "RECORDINGS_PATH", "/www/wwwroot/LiveKit/recordings"
        )
        return cls(
            host=host,
            user=user,
            password=password,
            key_path=key_path,
            port=port,
            recordings_path=recordings_path.rstrip("/"),
        )


class StorageClient:
    def __init__(self, config: StorageConfig):
        self._config = config

    @contextmanager
    def _connection(self) -> Iterable[paramiko.SSHClient]:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        try:
            connect_args = {
                "hostname": self._config.host,
                "username": self._config.user,
                "port": self._config.port,
                "timeout": 15,
            }
            if self._config.key_path:
                connect_args["key_filename"] = self._config.key_path
            elif self._config.password:
                connect_args["password"] = self._config.password
            else:
                raise StorageError(
                    "Provide STORAGE_PASSWORD or STORAGE_KEY_PATH for SSH auth"
                )
            client.connect(**connect_args)
            yield client
        except Exception as exc:  # pragma: no cover - defensive
            raise StorageError(f"SSH connection failed: {exc}") from exc
        finally:
            client.close()

    def _resolve(self, relative_path: str) -> str:
        relative_path = relative_path.strip("/")
        base = self._config.recordings_path
        full = posixpath.normpath(
            posixpath.join(base + "/", relative_path)
        )
        if not full.startswith(base):
            raise StorageError("Attempt to access path outside recordings root")
        return full

    def list_dir(self, relative_path: str = "", only_dirs: bool = True) -> List[str]:
        try:
            with self._connection() as client:
                with client.open_sftp() as sftp:
                    target = self._resolve(relative_path)
                    entries = sftp.listdir_attr(target)
        except FileNotFoundError:
            raise StorageError("Путь не найден на хранилище")
        except SSHException as exc:
            raise StorageError(f"Ошибка SSH/SFTP: {exc}") from exc
        names: List[str] = []
        for entry in entries:
            is_dir = stat.S_ISDIR(entry.st_mode)
            if only_dirs and not is_dir:
                continue
            if not only_dirs and is_dir:
                continue
            names.append(entry.filename)
        return sorted(names)

    def fetch_file(self, relative_path: str) -> io.BytesIO:
        try:
            with self._connection() as client:
                with client.open_sftp() as sftp:
                    remote_path = self._resolve(relative_path)
                    with sftp.file(remote_path, "rb") as remote_file:
                        payload = remote_file.read()
        except FileNotFoundError:
            raise StorageError("Файл не найден на хранилище")
        except SSHException as exc:
            raise StorageError(f"Ошибка SSH/SFTP: {exc}") from exc
        buffer = io.BytesIO(payload)
        buffer.name = posixpath.basename(relative_path)
        buffer.seek(0)
        return buffer


# Telegram handlers --------------------------------------------------------- #


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    text = (
        "Привет! Я помогаю скачать записи LiveKit.\n\n"
        "Команды:\n"
        " • /browse — выбрать комнату, пользователя и дату\n"
        " • /help — краткая справка\n\n"
        "Файлы берутся напрямую со storage-сервера через SSH."
    )
    await update.message.reply_text(text)


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(
        "Используйте /browse, чтобы выбрать записи. "
        "Выбирайте комнату → пользователя → дату → сегмент."
    )


def _build_keyboard(
    items: List[str],
    prefix: str,
    back_payload: str | None = None,
) -> InlineKeyboardMarkup:
    buttons: List[List[InlineKeyboardButton]] = []
    row: List[InlineKeyboardButton] = []
    for item in items:
        row.append(
            InlineKeyboardButton(
                item,
                callback_data=_encode_callback(prefix, item),
            )
        )
        if len(row) == 3:
            buttons.append(row)
            row = []
    if row:
        buttons.append(row)
    if back_payload:
        buttons.append(
            [InlineKeyboardButton("⬅️ Назад", callback_data=back_payload)]
        )
    return InlineKeyboardMarkup(buttons)


async def _list_rooms(context: ContextTypes.DEFAULT_TYPE) -> List[str]:
    storage: StorageClient = context.bot_data["storage"]
    return await asyncio.to_thread(storage.list_dir, "", True)


async def _list_users(context: ContextTypes.DEFAULT_TYPE, room: str) -> List[str]:
    storage: StorageClient = context.bot_data["storage"]
    relative = posixpath.join(room)
    return await asyncio.to_thread(storage.list_dir, relative, True)


async def _list_dates(
    context: ContextTypes.DEFAULT_TYPE,
    room: str,
    user: str,
) -> List[str]:
    storage: StorageClient = context.bot_data["storage"]
    relative = posixpath.join(room, user)
    return await asyncio.to_thread(storage.list_dir, relative, True)


async def _list_videos(
    context: ContextTypes.DEFAULT_TYPE,
    room: str,
    user: str,
    record_date: str,
) -> List[str]:
    storage: StorageClient = context.bot_data["storage"]
    relative = posixpath.join(room, user, record_date)
    return await asyncio.to_thread(storage.list_dir, relative, False)


async def _fetch_video(
    context: ContextTypes.DEFAULT_TYPE,
    relative_path: str,
) -> io.BytesIO:
    storage: StorageClient = context.bot_data["storage"]
    return await asyncio.to_thread(storage.fetch_file, relative_path)


async def browse(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    rooms = await _list_rooms(context)
    if not rooms:
        await update.message.reply_text("Комнаты не найдены в хранилище.")
        return
    markup = _build_keyboard(rooms, "room")
    await update.message.reply_text(
        "Выберите комнату:", reply_markup=markup, parse_mode=ParseMode.HTML
    )


async def browse_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()
    try:
        action, payload = _decode_callback(query.data)
    except ValueError:
        await query.edit_message_text("Некорректные данные клавиатуры. Попробуйте заново.")
        return

    user_data = context.user_data

    try:
        if action == "room":
            user_data["room"] = payload
            user_data.pop("user", None)
            user_data.pop("date", None)
            users = await _list_users(context, payload)
            if not users:
                await query.edit_message_text(
                    f"В комнате <b>{payload}</b> нет пользователей.",
                    parse_mode=ParseMode.HTML,
                )
                return
            markup = _build_keyboard(
                users,
                "user",
                back_payload="back:rooms",
            )
            await query.edit_message_text(
                f"Комната: <b>{payload}</b>\nВыберите пользователя:",
                reply_markup=markup,
                parse_mode=ParseMode.HTML,
            )
            return

        if action == "user":
            room = user_data.get("room")
            if not room:
                raise StorageError("Комната не выбрана. Используйте /browse заново.")
            user_data["user"] = payload
            user_data.pop("date", None)
            dates = await _list_dates(context, room, payload)
            if not dates:
                await query.edit_message_text(
                    f"Для {room}/{payload} нет папок с датами.",
                    parse_mode=ParseMode.HTML,
                )
                return
            markup = _build_keyboard(
                dates,
                "date",
                back_payload="back:rooms",
            )
            await query.edit_message_text(
                f"Комната: <b>{room}</b>\nПользователь: <b>{payload}</b>\n"
                "Выберите дату записи:",
                reply_markup=markup,
                parse_mode=ParseMode.HTML,
            )
            return

        if action == "date":
            room = user_data.get("room")
            user_name = user_data.get("user")
            if not room or not user_name:
                raise StorageError("Сначала выберите комнату и пользователя.")
            user_data["date"] = payload
            videos = await _list_videos(context, room, user_name, payload)
            if not videos:
                await query.edit_message_text(
                    f"Нет видеофайлов для {room}/{user_name}/{payload}.",
                    parse_mode=ParseMode.HTML,
                )
                return
            markup = _build_keyboard(
                videos,
                "video",
                back_payload="back:dates",
            )
            await query.edit_message_text(
                f"Комната: <b>{room}</b>\nПользователь: <b>{user_name}</b>\n"
                f"Дата: <b>{payload}</b>\nВыберите сегмент:",
                reply_markup=markup,
                parse_mode=ParseMode.HTML,
            )
            return

        if action == "video":
            room = user_data.get("room")
            user_name = user_data.get("user")
            record_date = user_data.get("date")
            if not room or not user_name or not record_date:
                raise StorageError("Выберите путь заново через /browse.")
            relative_path = posixpath.join(room, user_name, record_date, payload)
            await query.answer("Отправляю файл…", show_alert=False)
            try:
                video_buffer = await _fetch_video(context, relative_path)
            except StorageError as exc:
                await query.message.reply_text(f"Ошибка загрузки: {exc}")
                return
            await query.message.reply_document(
                document=video_buffer,
                caption=(
                    f"{room}/{user_name}/{record_date}/{payload}\n"
                    "Файл получен со storage."
                ),
            )
            return

        if action == "back":
            if payload == "rooms":
                rooms = await _list_rooms(context)
                markup = _build_keyboard(rooms, "room")
                await query.edit_message_text(
                    "Выберите комнату:",
                    reply_markup=markup,
                    parse_mode=ParseMode.HTML,
                )
                return
            if payload == "dates":
                room = user_data.get("room")
                user_name = user_data.get("user")
                if not room or not user_name:
                    raise StorageError("Сначала выберите комнату и пользователя.")
                dates = await _list_dates(context, room, user_name)
                markup = _build_keyboard(
                    dates,
                    "date",
                    back_payload="back:rooms",
                )
                await query.edit_message_text(
                    f"Комната: <b>{room}</b>\nПользователь: <b>{user_name}</b>\n"
                    "Выберите дату записи:",
                    reply_markup=markup,
                    parse_mode=ParseMode.HTML,
                )
                return

            await query.edit_message_text(
                "Неизвестная команда возврата. Запустите /browse заново."
            )
            return

        await query.edit_message_text("Неизвестное действие. Попробуйте снова.")
    except StorageError as exc:
        LOGGER.warning("Storage error: %s", exc)
        await query.message.reply_text(f"⚠️ {exc}")
    except Exception as exc:  # pragma: no cover - defensive
        LOGGER.exception("Unexpected error in callback")
        await query.message.reply_text("❌ Произошла ошибка. Попробуйте ещё раз.")


async def error_handler(update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
    LOGGER.exception("Unhandled exception while processing update: %s", update, exc_info=context.error)


async def main() -> None:
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    if not token:
        raise RuntimeError("TELEGRAM_BOT_TOKEN environment variable is required")

    storage_config = StorageConfig.from_env()
    storage_client = StorageClient(storage_config)

    application = (
        Application.builder()
        .token(token)
        .defaults(Defaults(parse_mode=ParseMode.HTML))
        .build()
    )
    application.bot_data["storage"] = storage_client

    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("help", help_command))
    application.add_handler(CommandHandler("browse", browse))
    application.add_handler(
        CallbackQueryHandler(
            browse_callback,
            pattern=r"^(room:|user:|date:|video:|back:)",
        )
    )
    application.add_error_handler(error_handler)

    LOGGER.info("Starting bot. Listening for updates…")
    await application.initialize()
    await application.start()
    await application.updater.start_polling()

    try:
        await asyncio.Event().wait()
    finally:
        await application.updater.stop()
        await application.stop()
        await application.shutdown()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:  # pragma: no cover - CLI convenience
        LOGGER.info("Bot stopped via Ctrl+C")

