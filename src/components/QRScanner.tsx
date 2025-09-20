import { useEffect, useRef, useState, useCallback } from 'react';
import QrScanner from 'qr-scanner';
import { Camera, Flashlight, FlashlightOff, Wallet, Send, Loader, X, CheckCircle, AlertCircle, Gamepad2, Users } from 'lucide-react';
import { qrPaymentService, QRPaymentRequest, PaymentProcessingResult } from '../services/QRPaymentService';
import { walletIntegrationService, Transaction, TransactionRequest } from '../services/WalletIntegrationService';
import { knirvanaBridgeService } from '../services/KnirvanaBridgeService';
import { personalKNIRVGRAPHService } from '../services/PersonalKNIRVGRAPHService';

interface QRScannerProps {
  onScan: (result: string) => void;
  onClose: () => void;
  isOpen: boolean;
}

interface PaymentState {
  step: 'scanning' | 'confirming' | 'processing' | 'success' | 'error';
  request?: QRPaymentRequest;
  result?: PaymentProcessingResult;
  error?: string;
  transaction?: Transaction;
}

interface KnirvanaConnectionState {
  step: 'scanning' | 'connecting' | 'merging' | 'success' | 'error';
  gameSession?: {
    sessionId: string;
    gameId: string;
    endpoint: string;
    publicKey: string;
  };
  error?: string;
  mergeProgress?: number;
}

// QRData interface removed as it's not currently used
// interface QRData {
//   version: string;
//   type: string;
//   session_id: string;
//   desktop_id: string;
//   target_id?: string;
//   expires_at: number;
//   endpoint: string;
//   public_key: string;
//   capabilities?: string[];
//   encrypted_payload?: string;
//   signature: string;
// }

export default function QRScanner({
  onScan,
  onClose,
  isOpen
}: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [qrScanner, setQrScanner] = useState<QrScanner | null>(null);
  const [hasFlash, setHasFlash] = useState(false);
  const [flashEnabled, setFlashEnabled] = useState(false);

  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Payment workflow state
  const [paymentState, setPaymentState] = useState<PaymentState>({ step: 'scanning' });
  const [userBalance, setUserBalance] = useState<{ nrn: string; balance: string }>({ nrn: '0', balance: '0' });

  // KNIRVANA connection state
  const [knirvanaState, setKnirvanaState] = useState<KnirvanaConnectionState>({ step: 'scanning' });

  // Load user balance when component opens
  const loadUserBalance = useCallback(async () => {
    try {
      const currentAccount = walletIntegrationService.getCurrentAccount();
      if (currentAccount) {
        const balance = await walletIntegrationService.getAccountBalance(currentAccount.id);
        setUserBalance({
          nrn: balance.nrnBalance,
          balance: balance.balance
        });
      }
    } catch (error) {
      console.error('Failed to load user balance:', error);
    }
  }, []);

  const handleKnirvanaConnection = useCallback(async (qrData: string) => {
    try {
      setKnirvanaState({ step: 'connecting' });

      // Parse KNIRVANA QR code
      let gameSession;
      if (qrData.startsWith('knirvana://')) {
        const url = new URL(qrData);
        gameSession = {
          sessionId: url.searchParams.get('session') || '',
          gameId: url.searchParams.get('game') || '',
          endpoint: url.searchParams.get('endpoint') || '',
          publicKey: url.searchParams.get('key') || ''
        };
      } else {
        // JSON format
        const parsed = JSON.parse(qrData);
        gameSession = {
          sessionId: parsed.sessionId || parsed.session,
          gameId: parsed.gameId || parsed.game,
          endpoint: parsed.endpoint || parsed.url,
          publicKey: parsed.publicKey || parsed.key
        };
      }

      if (!gameSession.sessionId || !gameSession.endpoint) {
        throw new Error('Invalid KNIRVANA session QR code');
      }

      setKnirvanaState({
        step: 'connecting',
        gameSession
      });

      // Connect to KNIRVANA game session
      await knirvanaBridgeService.connectToGameSession(gameSession);

      // Start graph merging process
      setKnirvanaState(prev => ({ ...prev, step: 'merging', mergeProgress: 0 }));

      // Get personal graph
      const personalGraph = await personalKNIRVGRAPHService.exportGraph();

      // Merge with collective graph
      await knirvanaBridgeService.mergeGraphs(personalGraph, {
        onProgress: (progress) => {
          setKnirvanaState(prev => ({ ...prev, mergeProgress: progress }));
        }
      });

      setKnirvanaState({
        step: 'success',
        gameSession,
        mergeProgress: 100
      });

      // Notify parent component
      onScan(`knirvana-connected:${gameSession.sessionId}`);

    } catch (error) {
      console.error('KNIRVANA connection error:', error);
      setKnirvanaState({
        step: 'error',
        error: error instanceof Error ? error.message : 'Connection failed'
      });
    }
  }, [onScan]);

  const handleScanResult = useCallback((data: string) => {
    try {
      // Check if this is a KNIRVANA game session QR code
      if (data.startsWith('knirvana://') || data.includes('knirvana-session')) {
        handleKnirvanaConnection(data);
        return;
      }

      // Parse QR code using the payment service
      const scanResult = qrPaymentService.parseQRCode(data);

      if (!scanResult.success) {
        setError(scanResult.error || 'Invalid QR code');
        return;
      }

      if (scanResult.data?.type === 'payment') {
        setPaymentState({
          step: 'confirming',
          request: scanResult.data
        });
      } else {
        // For non-payment QR codes, just pass the raw data
        onScan(data);
      }
    } catch (error) {
      console.error('QR scan error:', error);
      setPaymentState({
        step: 'error',
        error: error instanceof Error ? error.message : 'QR scan failed'
      });
    }
  }, [onScan, handleKnirvanaConnection]);



  const initializeScanner = useCallback(async () => {
    if (!videoRef.current) return;

    try {
      setError(null);
      setScanning(true);

      const scanner = new QrScanner(
        videoRef.current,
        (result) => handleScanResult(result.data),
        {
          highlightScanRegion: true,
          highlightCodeOutline: true,
          preferredCamera: 'environment', // Use back camera on mobile
        }
      );

      // Check if device has flash
      const hasFlashSupport = await QrScanner.hasCamera();
      setHasFlash(hasFlashSupport);

      await scanner.start();
      setQrScanner(scanner);
      setScanning(false);
    } catch (err) {
      console.error('Failed to initialize QR scanner:', err);
      setError('Failed to access camera. Please check permissions.');
      setScanning(false);
    }
  }, [handleScanResult]);

  useEffect(() => {
    if (isOpen && videoRef.current) {
      initializeScanner();
      loadUserBalance();
    }

    return () => {
      if (qrScanner) {
        qrScanner.destroy();
      }
    };
  }, [isOpen, initializeScanner, loadUserBalance, qrScanner]);

  // Handle payment confirmation
  /* const handlePaymentConfirmation = async () => {
    if (!paymentState.request) return;

    setPaymentState(prev => ({ ...prev, step: 'processing' }));

    try {
      const result = await qrPaymentService.processPayment(paymentState.request);

      if (result.success) {
        setPaymentState({
          step: 'success',
          request: paymentState.request,
          result
        });
      } else {
        setPaymentState({
          step: 'error',
          request: paymentState.request,
          error: result.error || 'Payment processing failed'
        });
      }
    } catch (error) {
      setPaymentState({
        step: 'error',
        request: paymentState.request,
        error: error instanceof Error ? error.message : 'Payment failed'
      });
    }
  }; */

  // Cancel payment and return to scanning
  /* const handlePaymentCancel = () => {
    setPaymentState({ step: 'scanning' });
  }; */

  // Retry payment after error
  /* const handlePaymentRetry = () => {
    if (paymentState.request) {
      setPaymentState({
        step: 'confirming',
        request: paymentState.request
      });
    } else {
      setPaymentState({ step: 'scanning' });
    }
  }; */

  // Process the payment
  const processPayment = async () => {
    if (!paymentState.request) {
      setError('Payment request not available');
      return;
    }

    setPaymentState(prev => ({ ...prev, step: 'processing' }));

    try {
      const request = paymentState.request;
      let transactionId: string;

      if (request.type === 'skill_invocation' && request.skillId && request.nrnCost) {
        // Handle skill invocation payment
        transactionId = await walletIntegrationService.invokeSkill({
          skillId: request.skillId,
          skillName: request.skillName || request.skillId,
          nrnCost: request.nrnCost,
          parameters: {},
          expectedOutput: {},
          timeout: 30000
        });
      } else if (request.type === 'payment' && request.amount && request.recipient) {
        // Handle regular payment
        const transactionRequest: TransactionRequest = {
          from: walletIntegrationService.getCurrentAccount()?.address || '',
          to: request.recipient,
          amount: request.amount,
          memo: request.memo,
          nrnAmount: request.nrnCost
        };

        transactionId = await walletIntegrationService.createTransaction(transactionRequest);
      } else {
        throw new Error('Unsupported payment type');
      }

      // Monitor transaction status
      const transaction = await walletIntegrationService.checkTransactionStatus(transactionId);

      setPaymentState({
        step: 'success',
        request,
        transaction: transaction || undefined
      });

      // Refresh balance
      await loadUserBalance();

    } catch (error) {
      console.error('Payment processing failed:', error);
      setPaymentState({
        step: 'error',
        request: paymentState.request,
        error: error instanceof Error ? error.message : 'Payment failed'
      });
    }
  };

  // Cancel payment and return to scanning
  const cancelPayment = () => {
    setPaymentState({ step: 'scanning' });
    setError(null);
  };

  const toggleFlash = async () => {
    if (qrScanner && hasFlash) {
      try {
        // Note: setFlash method may not be available in all QrScanner versions
        // This is a simplified implementation
        setFlashEnabled(!flashEnabled);
        console.log('Flash toggle requested:', !flashEnabled);
      } catch (err) {
        console.error('Failed to toggle flash:', err);
      }
    }
  };

  const handleClose = () => {
    if (qrScanner) {
      qrScanner.destroy();
      setQrScanner(null);
    }
    setError(null);
    setFlashEnabled(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gray-900 text-white">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Camera size={20} />
          Scan QR Code
        </h2>
        <div className="flex items-center gap-2">
          {hasFlash && (
            <button
              onClick={toggleFlash}
              className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors"
            >
              {flashEnabled ? <FlashlightOff size={20} /> : <Flashlight size={20} />}
            </button>
          )}
          <button
            onClick={handleClose}
            className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Scanner Area or Payment UI */}
      <div className="flex-1 relative">
        {paymentState.step === 'scanning' ? (
          <>
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
            />

            {/* Scanning overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative">
                {/* Scanning frame */}
                <div className="w-64 h-64 border-2 border-white rounded-lg relative">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-500 rounded-tl-lg"></div>
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-500 rounded-tr-lg"></div>
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-500 rounded-bl-lg"></div>
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-500 rounded-br-lg"></div>

                  {scanning && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : knirvanaState.step !== 'scanning' ? (
          /* KNIRVANA Connection UI */
          <div className="flex-1 bg-gray-900 p-6 flex flex-col justify-center">
            {knirvanaState.step === 'connecting' && (
              <div className="max-w-md mx-auto w-full space-y-6">
                <div className="text-center">
                  <Gamepad2 className="w-16 h-16 mx-auto mb-4 text-purple-400 animate-pulse" />
                  <h3 className="text-xl font-semibold text-white mb-2">Connecting to KNIRVANA</h3>
                  <p className="text-gray-400">Establishing connection to game session...</p>
                </div>

                {knirvanaState.gameSession && (
                  <div className="bg-gray-800 rounded-lg p-4 space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Session ID:</span>
                      <span className="text-white font-mono text-sm">{knirvanaState.gameSession.sessionId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Game ID:</span>
                      <span className="text-white">{knirvanaState.gameSession.gameId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Endpoint:</span>
                      <span className="text-white text-sm">{knirvanaState.gameSession.endpoint}</span>
                    </div>
                  </div>
                )}

                <div className="flex justify-center">
                  <Loader className="w-8 h-8 text-purple-400 animate-spin" />
                </div>
              </div>
            )}

            {knirvanaState.step === 'merging' && (
              <div className="max-w-md mx-auto w-full space-y-6">
                <div className="text-center">
                  <Users className="w-16 h-16 mx-auto mb-4 text-blue-400" />
                  <h3 className="text-xl font-semibold text-white mb-2">Merging Graphs</h3>
                  <p className="text-gray-400">Integrating your personal KNIRVGRAPH with the collective...</p>
                </div>

                <div className="space-y-4">
                  <div className="w-full bg-gray-700 rounded-full h-3">
                    <div
                      className="h-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
                      style={{ width: `${knirvanaState.mergeProgress || 0}%` }}
                    ></div>
                  </div>
                  <p className="text-center text-sm text-gray-400">
                    {knirvanaState.mergeProgress || 0}% complete
                  </p>
                </div>

                <div className="bg-gray-800 rounded-lg p-4">
                  <p className="text-sm text-gray-300 text-center">
                    Your errors and ideas are being semantically clustered with other players' contributions...
                  </p>
                </div>
              </div>
            )}

            {knirvanaState.step === 'success' && (
              <div className="max-w-md mx-auto w-full space-y-6">
                <div className="text-center">
                  <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-400" />
                  <h3 className="text-xl font-semibold text-white mb-2">Connected!</h3>
                  <p className="text-gray-400">Successfully connected to KNIRVANA collective graph</p>
                </div>

                <div className="bg-gray-800 rounded-lg p-4 space-y-3">
                  <div className="text-center">
                    <p className="text-green-400 font-semibold">Graph Merge Complete</p>
                    <p className="text-sm text-gray-400 mt-2">
                      Your personal KNIRVGRAPH is now part of the collective.
                      Other players can see your error and idea nodes, and you can see theirs!
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setKnirvanaState({ step: 'scanning' });
                    onClose();
                  }}
                  className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  Continue to Game
                </button>
              </div>
            )}

            {knirvanaState.step === 'error' && (
              <div className="max-w-md mx-auto w-full space-y-6">
                <div className="text-center">
                  <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-400" />
                  <h3 className="text-xl font-semibold text-white mb-2">Connection Failed</h3>
                  <p className="text-gray-400">Failed to connect to KNIRVANA session</p>
                </div>

                <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                  <p className="text-red-400 text-sm text-center">
                    {knirvanaState.error}
                  </p>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={() => setKnirvanaState({ step: 'scanning' })}
                    className="flex-1 py-3 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                  >
                    Try Again
                  </button>
                  <button
                    onClick={onClose}
                    className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Payment Workflow UI */
          <div className="flex-1 bg-gray-900 p-6 flex flex-col justify-center">
            {paymentState.step === 'confirming' && paymentState.request && (
              <div className="max-w-md mx-auto w-full space-y-6">
                <div className="text-center">
                  <Wallet className="w-16 h-16 mx-auto mb-4 text-blue-400" />
                  <h3 className="text-xl font-semibold text-white mb-2">Confirm Payment</h3>
                  <p className="text-gray-400">Review the payment details below</p>
                </div>

                <div className="bg-gray-800 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Type:</span>
                    <span className="text-white capitalize">{paymentState.request.type.replace('_', ' ')}</span>
                  </div>

                  {paymentState.request.skillName && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Skill:</span>
                      <span className="text-white">{paymentState.request.skillName}</span>
                    </div>
                  )}

                  {paymentState.request.amount && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Amount:</span>
                      <span className="text-white">{paymentState.request.amount} KNIRV</span>
                    </div>
                  )}

                  {paymentState.request.nrnCost && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">NRN Cost:</span>
                      <span className="text-yellow-400">{paymentState.request.nrnCost} NRN</span>
                    </div>
                  )}

                  {paymentState.request.recipient && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">To:</span>
                      <span className="text-white font-mono text-sm">{paymentState.request.recipient.slice(0, 20)}...</span>
                    </div>
                  )}
                </div>

                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-400">Your Balance:</span>
                    <span className="text-white">{userBalance.balance} KNIRV</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">NRN Balance:</span>
                    <span className="text-yellow-400">{userBalance.nrn} NRN</span>
                  </div>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={cancelPayment}
                    className="flex-1 py-3 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={processPayment}
                    className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center space-x-2"
                  >
                    <Send className="w-4 h-4" />
                    <span>Confirm Payment</span>
                  </button>
                </div>
              </div>
            )}

            {paymentState.step === 'processing' && (
              <div className="max-w-md mx-auto w-full text-center space-y-6">
                <Loader className="w-16 h-16 mx-auto text-blue-400 animate-spin" />
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">Processing Payment</h3>
                  <p className="text-gray-400">Please wait while we process your transaction...</p>
                </div>
              </div>
            )}

            {paymentState.step === 'success' && paymentState.transaction && (
              <div className="max-w-md mx-auto w-full text-center space-y-6">
                <CheckCircle className="w-16 h-16 mx-auto text-green-400" />
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">Payment Successful</h3>
                  <p className="text-gray-400">Your transaction has been processed</p>
                </div>

                <div className="bg-gray-800 rounded-lg p-4 text-left">
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-400">Transaction ID:</span>
                    <span className="text-white font-mono text-sm">{paymentState.transaction.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Status:</span>
                    <span className="text-green-400">{paymentState.transaction.status}</span>
                  </div>
                </div>

                <button
                  onClick={handleClose}
                  className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  Done
                </button>
              </div>
            )}

            {paymentState.step === 'error' && (
              <div className="max-w-md mx-auto w-full text-center space-y-6">
                <AlertCircle className="w-16 h-16 mx-auto text-red-400" />
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">Payment Failed</h3>
                  <p className="text-gray-400">{paymentState.error || 'An error occurred while processing your payment'}</p>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={cancelPayment}
                    className="flex-1 py-3 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                  >
                    Back to Scanner
                  </button>
                  <button
                    onClick={processPayment}
                    className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                  >
                    Retry
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="p-4 bg-gray-900 text-white text-center">
        <p className="text-sm">
          Position the QR code within the frame to scan
        </p>
        {error && (
          <p className="text-red-400 text-sm mt-2">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
