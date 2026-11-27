# iPhone 및 iPad 실행

iOS 17 이상을 대상으로 한다. SwiftUI 앱이 시스템 WKWebView에서 공용 TypeScript 서비스와 사진 등록 화면을 실행한다. 촬영·앨범 선택은 iOS 파일 입력 컨트롤, 화면 렌더링은 WebKit, 영속 데이터는 앱 전용 웹 데이터 저장소가 담당한다. Android에서는 현재 모바일 웹을 사용한다.

## 개발 빌드

Mac에서 프로젝트의 npm 의존성을 설치한 후 실행한다.

```sh
npm run build
python3 generate-ios.py
open Wardrobe.xcodeproj
```

Xcode에서 Wardrobe 스킴과 iPhone 시뮬레이터 또는 연결한 기기를 선택해 실행한다. 실기기는 Signing & Capabilities에서 본인의 개발 팀을 선택하고 필요하면 앱 식별자를 지정한다. 서명 정보는 저장소에 넣지 않는다. 생성된 프로젝트에는 Swift 소스와 웹 빌드 폴더 참조가 들어간다. 웹 소스를 바꾼 뒤에는 `npm run build`를 다시 실행한 후 Xcode에서 빌드한다. 앱 번들에는 최신 `dist/`만 복사된다.

```sh
xcodebuild -project Wardrobe.xcodeproj -scheme Wardrobe -configuration Debug \
  -destination 'generic/platform=iOS Simulator' -derivedDataPath /tmp/wardrobe-derived \
  CODE_SIGNING_ALLOWED=NO build
```

## 데이터와 권한

- `WardrobeApp.swift`는 읽기 전용 앱 번들을 기기 내부의 `127.0.0.1:41873`에서 서빙한다. 고정 origin과 기본 영속 웹 데이터 저장소가 앱 재시작 및 동일 식별자의 업데이트에서 IndexedDB를 다시 찾을 수 있도록 한다. 앱 식별자, origin 또는 포트 변경에는 데이터 이전이 필요하다.
- 리스너는 루프백 인터페이스에만 연결한다. 번들에 포함된 파일만 다루며 개인 사진·계정 정보·옷장 데이터의 HTTP 엔드포인트는 없다. 포트를 사용할 수 없으면 화면에 재시도 동작을 표시한다.
- WebKit의 파일 입력으로 사용자가 선택한 사진만 앱으로 들어온다. 카메라 사용 설명과 사진 보관함 사용 설명을 번들에 포함한다. 카메라가 없는 시뮬레이터에서는 사진 보관함을 사용한다.
- 옷장 내보내기는 앱에서 만든 JSON을 iOS 파일 저장 창으로 전달한다. 받은 복사본의 저장 위치는 사용자가 고른다. 앱의 임시 사본은 선택·취소·앱 재시작 때 정리한다.
- 웹뷰의 알림 계약은 `window.webkit?.messageHandlers?.wardrobeHaptic?.postMessage('selection')` 또는 `'success'`다. 이 앱의 기본 문서 origin에서 발생한 메인 프레임 메시지만 처리한다.
- 웹 프리뷰와 iOS 앱은 서로 다른 저장소를 사용한다. 이 버전에서 기기 변경·앱 삭제·저장 공간 정리 뒤 자동 복원되는 계정 동기화는 제공하지 않는다.

## 검증

Xcode 27.0에서 실제 서비스의 Vite 빌드를 넣어 두 앱을 빌드했다. 시뮬레이터용 Debug는 arm64와 x86_64, 기기용 무서명 Release는 arm64 바이너리를 생성했다. 두 앱의 HTML, JavaScript, CSS, 커버 이미지 전체를 원본 `dist/`와 바이트 단위로 대조했고 차이가 없었다. macOS에서 앱의 번들 파일 매핑 코드를 실행해 HTML의 JS·CSS 경로가 번들 안의 파일을 가리키는 것도 확인했다. 빌드된 Info.plist의 최소 OS는 17.0이며 카메라 권한 안내가 포함되어 있다.

작업 환경에서 CoreSimulatorService 연결과 루프백 서버 바인딩이 제한되어 iOS 앱 내부 화면을 열거나 기기를 조작하지 못했다. 실제 사진 선택·촬영·최초 권한 거절, 시스템 파일 저장창에서 내보내기·취소, 앱 재시작 후 저장 유지, 햅틱·터치 반응, 서명·설치 및 배터리 성능은 실기기 검증 대상이다. 이미지 입력은 JPEG, PNG, WebP를 지원한다. HEIC의 시스템 자동 변환 여부도 기기에서 확인해야 한다.

[WebKit의 iOS 파일 입력](https://developer.apple.com/documentation/webkit/wkuidelegate/webview(_:runopenpanelwith:initiatedbyframe:completionhandler:)) · [영속 웹 데이터 저장소](https://developer.apple.com/documentation/webkit/wkwebsitedatastore/default()) · [ATS 예외 범위](https://developer.apple.com/documentation/bundleresources/information-property-list/nsapptransportsecurity/nsexceptiondomains)
