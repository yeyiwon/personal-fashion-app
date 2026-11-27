#!/usr/bin/env python3
"""Generate the local Xcode project from the committed app source and Vite build."""
import argparse
import os
import plistlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument("--web-root", type=Path, default=ROOT / "dist")
parser.add_argument("--output", type=Path, default=ROOT / "Wardrobe.xcodeproj")
args = parser.parse_args()
web = args.web_root.resolve()
project = args.output.resolve()
if web.name != "dist" or not (web / "index.html").is_file():
    parser.exit(1, "Run npm run build first. The iOS app bundles dist/index.html.\n")
if project.suffix != ".xcodeproj":
    parser.exit(1, "Expected a .xcodeproj output path.\n")
project.mkdir(exist_ok=True, parents=True)

def ref(path):
    rel = os.path.relpath(path, project.parent)
    return '"' + rel.replace('\\', '\\\\').replace('"', '\\"') + '"'

def ident(n):
    return f"{n:024X}"

info = {
    "CFBundleDevelopmentRegion":"ko", "CFBundleDisplayName":"내 옷장",
    "CFBundleExecutable":"$(EXECUTABLE_NAME)", "CFBundleIdentifier":"$(PRODUCT_BUNDLE_IDENTIFIER)",
    "CFBundleInfoDictionaryVersion":"6.0", "CFBundleName":"$(PRODUCT_NAME)",
    "CFBundlePackageType":"APPL", "CFBundleShortVersionString":"0.2.0", "CFBundleVersion":"2",
    "LSRequiresIPhoneOS":True, "UILaunchScreen":{},
    "UIApplicationSceneManifest":{"UIApplicationSupportsMultipleScenes":False},
    "UISupportedInterfaceOrientations":["UIInterfaceOrientationPortrait","UIInterfaceOrientationLandscapeLeft","UIInterfaceOrientationLandscapeRight"],
    "NSCameraUsageDescription":"내 옷장에 등록할 의류를 촬영하는 데 사용합니다.",
    "NSPhotoLibraryUsageDescription":"선택한 의류 사진을 기기의 옷장에 등록하는 데 사용합니다.",
    "NSAppTransportSecurity":{"NSExceptionDomains":{"127.0.0.1":{"NSExceptionAllowsInsecureHTTPLoads":True}}},
}
with (project / "Wardrobe-Info.plist").open("wb") as f:
    plistlib.dump(info,f)
objs = {}
def obj(i, contents): objs[ident(i)] = contents
def array(*ids): return "(" + ",".join(map(ident,ids)) + ",)"
obj(1,f"isa = PBXProject; mainGroup = {ident(2)}; productRefGroup = {ident(3)}; targets = {array(4)}; buildConfigurationList = {ident(5)}; compatibilityVersion = \"Xcode 14.0\"; developmentRegion = ko; knownRegions = (ko, Base); hasScannedForEncodings = 0; projectDirPath = \"\"; projectRoot = \"\";")
obj(2,f'isa = PBXGroup; children = {array(7,8,3)}; sourceTree = "<group>";')
obj(3,f'isa = PBXGroup; children = {array(9)}; name = Products; sourceTree = "<group>";')
obj(4,f'isa = PBXNativeTarget; name = Wardrobe; productName = Wardrobe; productType = "com.apple.product-type.application"; productReference = {ident(9)}; buildConfigurationList = {ident(6)}; buildPhases = {array(10,11,12)}; buildRules = (); dependencies = ();')
for a,b,c in ((5,15,16),(6,17,18)):
    obj(a,f'isa = XCConfigurationList; buildConfigurations = {array(b,c)}; defaultConfigurationIsVisible = 0; defaultConfigurationName = Release;')
obj(7,f'isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = {ref(ROOT/"WardrobeApp.swift")}; sourceTree = SOURCE_ROOT;')
obj(8,f'isa = PBXFileReference; lastKnownFileType = folder; path = {ref(web)}; sourceTree = SOURCE_ROOT;')
obj(9,'isa = PBXFileReference; explicitFileType = wrapper.application; path = Wardrobe.app; sourceTree = BUILT_PRODUCTS_DIR;')
for i,typ,files in ((10,'Sources',array(13)),(11,'Frameworks','()'),(12,'Resources',array(14))):
    obj(i,f'isa = PBX{typ}BuildPhase; buildActionMask = 2147483647; files = {files}; runOnlyForDeploymentPostprocessing = 0;')
for a,b in ((13,7),(14,8)): obj(a,f'isa = PBXBuildFile; fileRef = {ident(b)};')
for i,name in ((15,'Debug'),(16,'Release'),(17,'Debug'),(18,'Release')):
    if i < 17:
        settings = 'SDKROOT = iphoneos; IPHONEOS_DEPLOYMENT_TARGET = 17.0; CLANG_ENABLE_MODULES = YES; SWIFT_VERSION = 5.0;'
    else:
        settings = f'PRODUCT_BUNDLE_IDENTIFIER = app.yeiwon.personalwardrobe; PRODUCT_NAME = Wardrobe; CODE_SIGN_STYLE = Automatic; TARGETED_DEVICE_FAMILY = "1,2"; SUPPORTS_MACCATALYST = NO; INFOPLIST_FILE = {ref(project/"Wardrobe-Info.plist")};'
    obj(i,f'isa = XCBuildConfiguration; name = {name}; buildSettings = {{ {settings} }};')
records = '\n'.join(f'    {key} = {{ {value} }};' for key,value in objs.items())
(project / 'project.pbxproj').write_text('// !$*UTF8*$!\n{\n archiveVersion = 1; classes = {}; objectVersion = 56;\n objects = {\n' + records + '\n };\n rootObject = '+ident(1)+';\n}\n')
print(project)
