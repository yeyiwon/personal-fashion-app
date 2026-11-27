import Foundation
import Network
import SwiftUI
import UIKit
import UniformTypeIdentifiers
import WebKit

// Only the packaged web build is exposed. Wardrobe records and photos never
// pass through this listener. Keeping the origin stable preserves IndexedDB.
final class BundleServer {
    static let port: UInt16 = 41873
    static let origin = URL(string: "http://127.0.0.1:\(port)/")!
    private static let contentSecurityPolicy = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'; form-action 'self'"
    private let queue = DispatchQueue(label: "app.wardrobe.bundle")
    private let listener: NWListener
    private let files: [String: URL]

    init(directory: URL) throws {
        let fm = FileManager.default
        // The iOS data container can be reached through the /var alias.
        let canonicalDirectory = directory.resolvingSymlinksInPath().standardizedFileURL
        let root = canonicalDirectory.path + "/"
        var assets: [String: URL] = [:]
        let entries = fm.enumerator(at: canonicalDirectory, includingPropertiesForKeys: [.isRegularFileKey, .isSymbolicLinkKey], options: [.skipsHiddenFiles])
        while let url = entries?.nextObject() as? URL {
            let attrs = try url.resourceValues(forKeys: [.isRegularFileKey, .isSymbolicLinkKey])
            let path = url.standardizedFileURL.path
            if attrs.isRegularFile == true && attrs.isSymbolicLink != true && path.hasPrefix(root) {
                assets["/" + path.dropFirst(root.count)] = url
            }
        }
        guard let index = assets["/index.html"] else { throw CocoaError(.fileNoSuchFile) }
        assets["/"] = index
        files = assets
        let params = NWParameters.tcp
        params.requiredLocalEndpoint = .hostPort(host: "127.0.0.1", port: NWEndpoint.Port(rawValue: Self.port)!)
        params.requiredInterfaceType = .loopback
        listener = try NWListener(using: params)
    }

    func start(ready: @escaping () -> Void, failed: @escaping () -> Void) {
        listener.stateUpdateHandler = { [weak self] state in
            switch state {
            case .ready:
                let onExpectedPort = self?.listener.port?.rawValue == Self.port
                DispatchQueue.main.async(execute: onExpectedPort ? ready : failed)
            case .waiting, .failed: DispatchQueue.main.async(execute: failed)
            default: break
            }
        }
        listener.newConnectionHandler = { [weak self] connection in
            guard let self else { connection.cancel(); return }
            connection.start(queue: self.queue)
            // Close peers that leave an incomplete header on a local socket.
            self.queue.asyncAfter(deadline: .now() + 8) { [weak connection] in connection?.cancel() }
            self.receive(connection, Data())
        }
        listener.start(queue: queue)
    }

    func stop() { listener.cancel() }

    private func receive(_ connection: NWConnection, _ header: Data) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 8192) { [weak self] chunk, _, done, error in
            guard let self, error == nil, let chunk, !chunk.isEmpty else { connection.cancel(); return }
            var data = header
            data.append(chunk)
            guard data.count <= 16384 else { connection.cancel(); return }
            let terminator = Data([13, 10, 13, 10])
            if let end = data.range(of: terminator),
               let text = String(data: data[..<end.lowerBound], encoding: .utf8) {
                self.respond(connection, text)
            } else if done { connection.cancel() }
            else { self.receive(connection, data) }
        }
    }

    private func respond(_ connection: NWConnection, _ headers: String) {
        let lines = headers.components(separatedBy: "\r\n")
        let request = (lines.first ?? "").split(separator: " ")
        let validHost = lines.dropFirst().contains { $0.lowercased() == "host: 127.0.0.1:\(Self.port)" }
        guard validHost, request.count == 3, request[0] == "GET" || request[0] == "HEAD",
              let path = request[1].split(separator: "?", maxSplits: 1).first?.removingPercentEncoding,
              let file = files[path], let payload = try? Data(contentsOf: file, options: .mappedIfSafe)
        else {
            let response = Data("HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".utf8)
            send(connection, response)
            return
        }
        let known = ["html":"text/html; charset=utf-8","js":"text/javascript; charset=utf-8","mjs":"text/javascript; charset=utf-8","css":"text/css; charset=utf-8","json":"application/json","webmanifest":"application/manifest+json","svg":"image/svg+xml","woff2":"font/woff2"]
        let type = known[file.pathExtension] ?? UTType(filenameExtension: file.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
        var response = Data("HTTP/1.1 200 OK\r\nContent-Type: \(type)\r\nContent-Length: \(payload.count)\r\nCache-Control: no-store\r\nContent-Security-Policy: \(Self.contentSecurityPolicy)\r\nReferrer-Policy: no-referrer\r\nX-Content-Type-Options: nosniff\r\nCross-Origin-Resource-Policy: same-origin\r\nConnection: close\r\n\r\n".utf8)
        if request[0] == "GET" { response.append(payload) }
        send(connection, response)
    }

    private func send(_ connection: NWConnection, _ data: Data) {
        connection.send(content: data, completion: .contentProcessed { _ in connection.cancel() })
    }
}

@MainActor
final class LocalApp: ObservableObject {
    enum Status { case starting, ready, failed(String) }
    @Published private(set) var status: Status = .starting
    private var server: BundleServer?
    private var generation = 0

    func startIfNeeded() {
        if case .starting = status, server == nil { start() }
    }

    func start() {
        generation += 1
        let ticket = generation
        server?.stop()
        status = .starting
        guard let directory = Bundle.main.url(forResource: "dist", withExtension: nil),
              let next = try? BundleServer(directory: directory) else {
            status = .failed("앱 화면을 읽을 수 없어요. 개발 빌드라면 웹 빌드 후 앱을 다시 설치해 주세요.")
            return
        }
        server = next
        next.start(ready: { [weak self] in
            guard self?.generation == ticket else { return }
            self?.status = .ready
        }, failed: { [weak self] in
            guard self?.generation == ticket else { return }
            self?.status = .failed("기기 안의 옷장을 열 수 없어요. 잠시 후 다시 시도해 주세요.")
        })
    }

    func navigationFailed() {
        status = .failed("옷장 화면을 불러오지 못했어요. 다시 시도해 주세요.")
    }
}

private struct WardrobeView: UIViewRepresentable {
    let failure: () -> Void

    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler, WKDownloadDelegate, UIDocumentPickerDelegate {
        let failure: () -> Void
        weak var webView: WKWebView?
        private var activeDownload: WKDownload?
        private var pickerOpen = false
        private let exportFolder = FileManager.default.temporaryDirectory.appendingPathComponent("WardrobeExport", isDirectory: true)
        private var exportFile: URL?

        init(failure: @escaping () -> Void) {
            self.failure = failure
            super.init()
            discardExport()
        }

        private func discardExport() {
            activeDownload = nil
            pickerOpen = false
            exportFile = nil
            try? FileManager.default.removeItem(at: exportFolder)
        }

        private func exportError() {
            discardExport()
            guard let parent = webView?.window?.rootViewController, parent.presentedViewController == nil else { return }
            let alert = UIAlertController(title: "파일을 저장하지 못했어요", message: "내보내기를 다시 시도해 주세요.", preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "확인", style: .default))
            parent.present(alert, animated: true)
        }

        private func trusted(_ url: URL?) -> Bool {
            url?.scheme == "http" && url?.host == "127.0.0.1" && url?.port == Int(BundleServer.port)
        }
        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.frameInfo.isMainFrame, trusted(message.frameInfo.request.url) else { return }
            if message.body as? String == "selection" { UISelectionFeedbackGenerator().selectionChanged() }
            if message.body as? String == "success" { UINotificationFeedbackGenerator().notificationOccurred(.success) }
        }
        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            if action.shouldPerformDownload, action.sourceFrame.isMainFrame, trusted(action.sourceFrame.request.url),
               action.request.url?.absoluteString.hasPrefix("blob:" + BundleServer.origin.absoluteString) == true {
                decisionHandler(activeDownload == nil && !pickerOpen ? .download : .cancel)
                return
            }
            if action.navigationType == .linkActivated, action.sourceFrame.isMainFrame,
               trusted(action.sourceFrame.request.url), let url = action.request.url,
               url.scheme == "https", !trusted(url) {
                decisionHandler(.cancel)
                UIApplication.shared.open(url)
                return
            }
            let allowed = action.targetFrame?.isMainFrame == true && trusted(action.request.url)
            decisionHandler(allowed ? .allow : .cancel)
        }
        func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
            guard activeDownload == nil, !pickerOpen else { download.cancel { _ in }; return }
            activeDownload = download
            download.delegate = self
        }
        func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
            let filenames = ["application/json": "내 옷장.json", "image/jpeg": "나의 룩북.jpg"]
            guard download === activeDownload, let name = filenames[response.mimeType ?? ""] else {
                completionHandler(nil)
                return
            }
            do {
                try FileManager.default.createDirectory(at: exportFolder, withIntermediateDirectories: true, attributes: [.protectionKey: FileProtectionType.complete])
                let destination = exportFolder.appendingPathComponent(name)
                exportFile = destination
                completionHandler(destination)
            } catch {
                completionHandler(nil)
                exportError()
            }
        }
        func downloadDidFinish(_ download: WKDownload) {
            guard activeDownload === download, let exportFile else { return }
            guard let parent = webView?.window?.rootViewController, parent.presentedViewController == nil else { exportError(); return }
            activeDownload = nil
            pickerOpen = true
            let picker = UIDocumentPickerViewController(forExporting: [exportFile], asCopy: true)
            picker.delegate = self
            parent.present(picker, animated: true)
        }
        func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
            if activeDownload === download { exportError() }
        }
        func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) { discardExport() }
        func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) { discardExport() }

        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
            webView.load(URLRequest(url: BundleServer.origin))
        }
        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            if (error as NSError).code != NSURLErrorCancelled { failure() }
        }
        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            if (error as NSError).code != NSURLErrorCancelled { failure() }
        }
    }

    func makeCoordinator() -> Coordinator { Coordinator(failure: failure) }
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.preferences.javaScriptCanOpenWindowsAutomatically = false
        config.userContentController.add(context.coordinator, name: "wardrobeHaptic")
        let view = WKWebView(frame: .zero, configuration: config)
        context.coordinator.webView = view
        view.navigationDelegate = context.coordinator
        // iOS supplies its image picker / camera UI for the web file inputs.
        view.allowsBackForwardNavigationGestures = false
        view.scrollView.contentInsetAdjustmentBehavior = .never
        view.load(URLRequest(url: BundleServer.origin))
        return view
    }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
    static func dismantleUIView(_ uiView: WKWebView, coordinator: Coordinator) {
        uiView.configuration.userContentController.removeScriptMessageHandler(forName: "wardrobeHaptic")
        uiView.navigationDelegate = nil
        uiView.stopLoading()
    }
}

@main
struct WardrobeApp: App {
    @StateObject private var model = LocalApp()
    var body: some Scene {
        WindowGroup {
            Group {
                switch model.status {
                case .starting: ProgressView("옷장 여는 중")
                case .ready: WardrobeView(failure: model.navigationFailed)
                case .failed(let message):
                    VStack(spacing: 16) {
                        Text(message).multilineTextAlignment(.center)
                        Button("다시 열기", action: model.start).buttonStyle(.borderedProminent)
                    }.padding(24)
                }
            }
            .onAppear(perform: model.startIfNeeded)
        }
    }
}
