# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['simple_recorder.py'],
    pathex=[],
    binaries=[],
    datas=[],
    hiddenimports=['tkinter', 'cv2', 'mss', 'numpy', 'websocket', 'requests', 'certifi'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='SimpleRecorder',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
app = BUNDLE(
    exe,
    name='SimpleRecorder.app',
    icon=None,
    bundle_identifier=None,
)
