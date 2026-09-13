// OCR the pages of a PDF with Apple's Vision framework.
//
// Usage: visionocr <pdf> [first] [last] [languages]
//   languages: comma-separated BCP-47, default "ru-RU,en-US"
// Prints one JSON object per line: {"page":N,"text":"...","confidence":0.93}
// Renders each page with CoreGraphics at 2x, so nothing else needs to.
import Foundation
import CoreGraphics
import Vision
import ImageIO

let args = CommandLine.arguments
guard args.count >= 2, let doc = CGPDFDocument(URL(fileURLWithPath: args[1]) as CFURL) else {
    FileHandle.standardError.write("usage: visionocr <pdf> [first] [last] [languages]\n".data(using: .utf8)!)
    exit(2)
}
let first = args.count > 2 ? Int(args[2]) ?? 1 : 1
let last = args.count > 3 ? Int(args[3]) ?? doc.numberOfPages : doc.numberOfPages
let languages = (args.count > 4 ? args[4] : "ru-RU,en-US").split(separator: ",").map(String.init)
let scale: CGFloat = 2.0

func render(_ page: CGPDFPage) -> CGImage? {
    let box = page.getBoxRect(.mediaBox)
    let width = Int(box.width * scale), height = Int(box.height * scale)
    guard let ctx = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
                              space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue) else { return nil }
    ctx.setFillColor(gray: 1, alpha: 1)
    ctx.fill(CGRect(x: 0, y: 0, width: width, height: height))
    ctx.scaleBy(x: scale, y: scale)
    ctx.drawPDFPage(page)
    return ctx.makeImage()
}

func json(_ s: String) -> String {
    let data = try! JSONSerialization.data(withJSONObject: [s], options: [])
    let arr = String(data: data, encoding: .utf8)!
    return String(arr.dropFirst().dropLast())
}

for n in first...min(last, doc.numberOfPages) {
    guard let page = doc.page(at: n), let image = render(page) else {
        print("{\"page\":\(n),\"text\":\"\",\"confidence\":0,\"error\":\"render failed\"}")
        continue
    }
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.recognitionLanguages = languages
    request.usesLanguageCorrection = true
    let handler = VNImageRequestHandler(cgImage: image, options: [:])
    do {
        try handler.perform([request])
        var lines: [String] = []
        var total: Float = 0
        for obs in request.results ?? [] {
            if let c = obs.topCandidates(1).first { lines.append(c.string); total += c.confidence }
        }
        let conf = lines.isEmpty ? 0 : total / Float(lines.count)
        print("{\"page\":\(n),\"text\":\(json(lines.joined(separator: "\n"))),\"confidence\":\(conf)}")
    } catch {
        print("{\"page\":\(n),\"text\":\"\",\"confidence\":0,\"error\":\(json(error.localizedDescription))}")
    }
    fflush(stdout)
}
