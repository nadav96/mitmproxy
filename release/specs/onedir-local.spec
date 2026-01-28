"""
Local build spec - same as onedir.spec but with ad-hoc signing instead of Developer ID.
"""
from pathlib import Path
import platform

from PyInstaller.building.api import PYZ, EXE, COLLECT
from PyInstaller.building.build_main import Analysis

here = Path(r".")
tools = ["mitmproxy", "mitmdump", "mitmweb"]

if platform.system() == "Darwin":
    icon = "icon.icns"
else:
    icon = "icon.ico"

analysis = Analysis(
    tools,
    excludes=["tcl", "tk", "tkinter"],
    pathex=[str(here)],
)

pyz = PYZ(analysis.pure, analysis.zipped_data)
executables = []
for tool in tools:
    executables.append(EXE(
        pyz,
        # analysis.scripts has all runtime hooks and all of our tools.
        # remove the other tools.
        [s for s in analysis.scripts if s[0] not in tools or s[0] == tool],
        [],
        exclude_binaries=True,
        name=tool,
        console=True,
        upx=False,
        icon=icon,
        # Use ad-hoc signing for local builds (no Developer ID required)
        codesign_identity=None,
        entitlements_file=None,
    ))

coll = COLLECT(
    *executables,
    analysis.binaries,
    analysis.zipfiles,
    analysis.datas,
    strip=False,
    upx=False,
    name="onedir"
)

# Skip macOS app bundle for local builds
