import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import * as Icons from 'lucide-react';

interface CameraScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (scannedText: string) => void;
}

export const CameraScannerModal: React.FC<CameraScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
}) => {
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setScannerError(null);
    setLastScanned(null);

    const timer = setTimeout(() => {
      try {
        const config = {
          fps: 10,
          qrbox: { width: 280, height: 180 },
          aspectRatio: 1.0,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.QR_CODE,
          ],
        };

        const scanner = new Html5QrcodeScanner('reader', config, false);
        scannerRef.current = scanner;

        scanner.render(
          (decodedText) => {
            const trimmed = decodedText.trim();
            if (trimmed) {
              setLastScanned(trimmed);
              onScanSuccess(trimmed);
            }
          },
          () => {
            // Ignore scan errors
          }
        );
      } catch (err: any) {
        setScannerError(err.message || 'Camera permission denied or camera unavailable');
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4 text-xs">
      <div className="bg-white border border-gray-200 rounded-xl w-full max-w-lg p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-200">
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Icons.Camera className="w-5 h-5 text-blue-600" />
            Barcode / QR Camera Scanner
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded transition"
          >
            <Icons.X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-gray-500 text-xs">
          Point your device camera at the physical barcode or QR code on the box. Decoded IMEIs will automatically be appended.
        </p>

        {scannerError ? (
          <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-medium flex items-center gap-2">
            <Icons.AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{scannerError}</span>
          </div>
        ) : (
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 overflow-hidden min-h-[300px]">
            <div id="reader" className="w-full text-gray-800"></div>
          </div>
        )}

        {lastScanned && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center justify-between">
            <span className="font-bold">Last Scanned:</span>
            <span className="font-mono text-gray-900 bg-white px-2.5 py-1 rounded border border-gray-200 font-bold">
              {lastScanned}
            </span>
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-semibold"
          >
            Done Scanning
          </button>
        </div>
      </div>
    </div>
  );
};

export default CameraScannerModal;
