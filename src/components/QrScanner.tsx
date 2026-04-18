import { useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";

interface QrScannerProps {
  onScan: (text: string) => void;
  onClose: () => void;
}

const QrScanner = ({ onScan, onClose }: QrScannerProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const id = "qr-reader-" + Math.random().toString(36).slice(2, 8);
    ref.current.id = id;

    const scanner = new Html5Qrcode(id);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded) => {
          onScan(decoded);
          scanner.stop().then(() => scanner.clear()).catch(() => {});
        },
        () => {}
      )
      .catch(() => {});

    return () => {
      try {
        if (scannerRef.current?.isScanning) {
          scannerRef.current.stop().then(() => scannerRef.current?.clear()).catch(() => {});
        }
      } catch {}
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-md flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <h3 className="font-display text-lg text-primary text-center mb-4">Scan Loyalty QR</h3>
        <div ref={ref} className="w-full rounded-2xl overflow-hidden border-2 border-primary/40" />
        <button
          onClick={onClose}
          className="w-full mt-4 py-3 bg-secondary text-foreground font-medium rounded-xl ios-press"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default QrScanner;
