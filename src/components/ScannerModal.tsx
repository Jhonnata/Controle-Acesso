import React, { useEffect, useRef, useState } from 'react';
import { X, Camera, Search, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { Attendee } from '../types';

interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  attendees: Attendee[];
  onCheckInAttendee: (attendee: Attendee) => void;
}

export const ScannerModal: React.FC<ScannerModalProps> = ({
  isOpen,
  onClose,
  attendees,
  onCheckInAttendee,
}) => {
  const [manualCode, setManualCode] = useState('');
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [scannedResult, setScannedResult] = useState<string | null>(null);
  const [matchedAttendee, setMatchedAttendee] = useState<Attendee | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setManualCode('');
      setScannedResult(null);
      setMatchedAttendee(null);
      setScannerError(null);
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async () => {
    try {
      setScannerError(null);
      const element = document.getElementById('qr-reader-container');
      if (!element) return;

      if (html5QrCodeRef.current) {
        try {
          await html5QrCodeRef.current.stop();
        } catch (_) {}
      }

      const html5QrCode = new Html5Qrcode('qr-reader-container');
      html5QrCodeRef.current = html5QrCode;

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      };

      await html5QrCode.start(
        { facingMode: 'environment' },
        config,
        (decodedText) => {
          handleScanSuccess(decodedText);
        },
        () => {
          // ignore scan frame misses
        }
      );

      setCameraActive(true);
    } catch (err: any) {
      console.warn('Camera error or permission denied:', err);
      setScannerError(
        'Não foi possível acessar a câmera. Use a busca manual por código/CPF abaixo.'
      );
      setCameraActive(false);
    }
  };

  const stopCamera = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        await html5QrCodeRef.current.clear();
      } catch (_) {}
      html5QrCodeRef.current = null;
    }
    setCameraActive(false);
  };

  const handleScanSuccess = (text: string) => {
    const cleanText = text.trim();
    setScannedResult(cleanText);

    // Try finding matching attendee by: document, ID, name or raw text
    const normalized = cleanText.toLowerCase().replace(/[^a-z0-9]/g, '');
    const found = attendees.find((a) => {
      const docClean = (a.document || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const nameClean = a.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const idClean = a.id.toLowerCase().replace(/[^a-z0-9]/g, '');

      return (
        (docClean && docClean.includes(normalized)) ||
        (docClean && normalized.includes(docClean)) ||
        nameClean.includes(normalized) ||
        idClean === normalized
      );
    });

    if (found) {
      setMatchedAttendee(found);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate([50, 50, 50]);
        } catch (_) {}
      }
    } else {
      setMatchedAttendee(null);
    }
  };

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleScanSuccess(manualCode.trim());
  };

  const handleConfirmAccess = () => {
    if (matchedAttendee) {
      onCheckInAttendee(matchedAttendee);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl transition-colors">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Leitor de QR Code</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Aponte para o crachá ou digite o CPF</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-300 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto space-y-4">
          {/* Camera Viewport */}
          <div className="relative rounded-3xl overflow-hidden bg-black border border-slate-200 dark:border-slate-800 min-h-[220px] flex items-center justify-center shadow-inner">
            <div id="qr-reader-container" className="w-full" />

            {!cameraActive && (
              <div className="p-6 text-center text-slate-400 space-y-3">
                <AlertCircle className="w-8 h-8 mx-auto text-amber-400/90" />
                <p className="text-xs max-w-xs mx-auto text-slate-300">
                  {scannerError || 'Iniciando câmera para leitura de QR Code...'}
                </p>
                <button
                  type="button"
                  onClick={startCamera}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-bold inline-flex items-center gap-1.5 shadow-sm"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Tentar ligar câmera</span>
                </button>
              </div>
            )}
          </div>

          {/* Matched Attendee Card */}
          {matchedAttendee ? (
            <div className="p-4 rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/40 space-y-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400 tracking-wider">
                    Participante Identificado
                  </div>
                  <h4 className="text-base font-black text-slate-900 dark:text-slate-100">{matchedAttendee.name}</h4>
                  <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5 font-medium">
                    Empresa: <strong>{matchedAttendee.exhibitor}</strong>
                  </p>
                  {matchedAttendee.document && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">CPF: {matchedAttendee.document}</p>
                  )}
                </div>

                <div
                  className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    matchedAttendee.isCheckedIn
                      ? 'bg-emerald-600 text-white'
                      : 'bg-amber-500 text-white'
                  }`}
                >
                  {matchedAttendee.isCheckedIn ? 'Já Entrou' : 'Pendente'}
                </div>
              </div>

              <button
                type="button"
                onClick={handleConfirmAccess}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-2 active:scale-98 transition-transform shadow-md shadow-emerald-600/30"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>
                  {matchedAttendee.isCheckedIn
                    ? 'Desmarcar / Modificar Entrada'
                    : 'Confirmar Entrada Agora'}
                </span>
              </button>
            </div>
          ) : scannedResult ? (
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>
                Código lido: <strong>"{scannedResult}"</strong> (Nenhum participante com esse CPF encontrado)
              </span>
            </div>
          ) : null}

          {/* Manual input fallback */}
          <form onSubmit={handleManualSearch} className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
              Ou digite o CPF ou Nome:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Ex: 280.618.768-09 ou Elen"
                className="flex-1 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                className="px-4 py-2.5 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-2xl text-xs font-bold flex items-center gap-1 shrink-0"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Buscar</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
