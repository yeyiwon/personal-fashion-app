import Foundation
import Vision
import CoreImage
import ImageIO
import UniformTypeIdentifiers

@main struct GarmentVision {
    static func main() {
        guard #available(macOS 14, *) else { exit(2) }
        if CommandLine.arguments.contains("--status") { print("available"); return }
        let receipt = CommandLine.arguments.contains("--receipt")
        let data = FileHandle.standardInput.readDataToEndOfFile()
        guard data.count < 1800000, let source = CGImageSourceCreateWithData(data as CFData, nil),
              let cg = CGImageSourceCreateThumbnailAtIndex(source, 0, [
                kCGImageSourceCreateThumbnailFromImageAlways:true,
                kCGImageSourceCreateThumbnailWithTransform:true,
                kCGImageSourceThumbnailMaxPixelSize:receipt ? 1600 : 720
              ] as CFDictionary) else { exit(2) }
        var fields: [String:Any] = [:]
        let handler = VNImageRequestHandler(cgImage:cg)
        if receipt {
            let request = VNRecognizeTextRequest()
            request.recognitionLevel = .accurate
            request.recognitionLanguages = ["ko-KR", "en-US"]
            do {
                try handler.perform([request])
                let lines = (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }
                FileHandle.standardOutput.write(try JSONSerialization.data(withJSONObject:["lines":Array(lines.prefix(160))]))
                return
            } catch { exit(3) }
        }
        let classify = VNClassifyImageRequest()
        if (try? handler.perform([classify])) != nil {
            fields["labels"] = (classify.results ?? []).filter { $0.confidence >= 0.17 }.prefix(12).map { ["name":$0.identifier,"score":$0.confidence] as [String:Any] }
        }
        let request = VNGenerateForegroundInstanceMaskRequest()
        if (try? handler.perform([request])) != nil, let obs=request.results?.first, !obs.allInstances.isEmpty,
           let buffer = try? obs.generateMaskedImage(ofInstances:obs.allInstances,from:handler,croppedToInstancesExtent:true) {
            let context=CIContext(), image=CIImage(cvPixelBuffer:buffer)
            if let png=context.pngRepresentation(of:image,format:.RGBA8,colorSpace:CGColorSpace(name:CGColorSpace.sRGB)!) {
                fields["cutout"]="data:image/png;base64,"+png.base64EncodedString()
            }
        }
        if let bytes=try? JSONSerialization.data(withJSONObject:fields){ FileHandle.standardOutput.write(bytes) } else { exit(3) }
    }
}
