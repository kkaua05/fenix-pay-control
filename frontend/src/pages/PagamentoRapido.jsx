import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';

// Dynamically import Tesseract to avoid issues
let Tesseract = null;

const PagamentoRapido = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [step, setStep] = useState('camera'); // camera | processing | confirm | result
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrText, setOcrText] = useState('');
  const [detectedValue, setDetectedValue] = useState('');
  const [loading, setLoading] = useState(false);

  // Client search
  const [clientes, setClientes] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCliente, setSelectedCliente] = useState(null);
  const [showResults, setShowResults] = useState(false);

  // Form
  const [formaPagamento, setFormaPagamento] = useState('CREDITO');
  const [observacoes, setObservacoes] = useState('');
  const [manualValue, setManualValue] = useState('');

  // Start camera on mount
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setCameraActive(true);
      }
    } catch (err) {
      showToast('Erro ao acessar câmera. Verifique as permissões.', 'error');
      console.error('Camera error:', err);
    }
  }, [showToast]);

  useEffect(() => {
    startCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [startCamera]);

  // Search clients
  useEffect(() => {
    if (searchTerm.length >= 2) {
      const timer = setTimeout(async () => {
        try {
          const response = await api.get(`/clientes/search?q=${encodeURIComponent(searchTerm)}`);
          setClientes(response.data.data || []);
          setShowResults(true);
        } catch (error) {
          console.error('Erro ao buscar clientes:', error);
        }
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setClientes([]);
      setShowResults(false);
    }
  }, [searchTerm]);

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedImage(imageDataUrl);

    // Stop camera
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      setCameraActive(false);
    }

    // Process OCR
    setStep('processing');
    processOCR(imageDataUrl);
  };

  const processOCR = async (imageDataUrl) => {
    setOcrProgress(0);
    setOcrText('');

    try {
      // Dynamically import Tesseract.js for faster initial load
      if (!Tesseract) {
        Tesseract = await import('tesseract.js');
      }

      const result = await Tesseract.recognize(
        imageDataUrl,
        'por',
        {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              setOcrProgress(Math.round(m.progress * 100));
            }
          }
        }
      );

      const text = result.data.text;
      setOcrText(text);
      setOcrProgress(100);

      // Try to extract value from OCR text
      const extracted = extractValue(text);
      setDetectedValue(extracted);
      setManualValue(extracted);

      setTimeout(() => {
        setStep('confirm');
      }, 500);
    } catch (error) {
      console.error('OCR error:', error);
      showToast('Não foi possível ler o valor automaticamente. Digite manualmente.', 'warning');
      setStep('confirm');
    }
  };

  const extractValue = (text) => {
    if (!text) return '';

    // Patterns to find R$ values in the text
    const patterns = [
      /R?\$?\s?(\d{1,3}(?:\.\d{3})*,\d{2})/g,
      /R?\$?\s?(\d+[,.]\d{2})/g,
      /total[:\s]*R?\$?\s?(\d+[,.]\d{2})/i,
      /valor[:\s]*R?\$?\s?(\d+[,.]\d{2})/i,
      /R?\$?\s?(\d+[,.]\d{2})/,
    ];

    for (const pattern of patterns) {
      const matches = [...text.matchAll(pattern)];
      if (matches.length > 0) {
        // Return the last match value (usually the total)
        const lastMatch = matches[matches.length - 1][1];
        return lastMatch.replace(/\./g, '').replace(',', '.');
      }
    }

    // Try to find any number that looks like a currency value
    const numbers = text.match(/\d+[,.]\d{2}/g);
    if (numbers && numbers.length > 0) {
      // Return the largest number
      const largest = numbers
        .map(n => parseFloat(n.replace(/\./g, '').replace(',', '.')))
        .reduce((max, n) => n > max ? n : max, 0);
      if (largest > 0) {
        return largest.toFixed(2);
      }
    }

    return '';
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setOcrText('');
    setDetectedValue('');
    setOcrProgress(0);
    setStep('camera');
    startCamera();
  };

  const handleSubmit = async () => {
    const finalValue = manualValue || detectedValue;

    if (!selectedCliente) {
      showToast('Selecione um cliente', 'error');
      return;
    }

    if (!finalValue || parseFloat(finalValue) <= 0) {
      showToast('Informe um valor válido', 'error');
      return;
    }

    setLoading(true);
    try {
      // Convert base64 to Blob
      const blob = await fetch(capturedImage).then(r => r.blob());
      const file = new File([blob], 'comprovante.jpg', { type: 'image/jpeg' });

      const formDataToSend = new FormData();
      formDataToSend.append('cliente_id', String(selectedCliente.id));
      formDataToSend.append('cliente_nome', String(selectedCliente.nome_completo));
      formDataToSend.append('valor', String(finalValue));
      formDataToSend.append('forma_pagamento', formaPagamento);
      formDataToSend.append('observacoes', observacoes || '');
      formDataToSend.append('comprovante', file);

      const response = await api.post('/pagamentos', formDataToSend, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.success) {
        setStep('result');
        showToast('✅ Pagamento registrado com sucesso!', 'success');
      } else {
        showToast(response.data.message || 'Erro ao registrar pagamento', 'error');
      }
    } catch (error) {
      console.error('Erro ao salvar:', error);
      showToast(error.response?.data?.message || 'Erro ao registrar pagamento', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ===== RENDER CAMERA STEP =====
  const renderCamera = () => (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        position: 'relative',
        maxWidth: '500px',
        margin: '0 auto',
        borderRadius: '16px',
        overflow: 'hidden',
        border: '2px solid #2A3040',
        background: '#000'
      }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          style={{ width: '100%', display: 'block', transform: 'scaleX(-1)' }}
        />
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '80%',
          height: '60%',
          border: '3px dashed rgba(255, 107, 0, 0.6)',
          borderRadius: '12px',
          pointerEvents: 'none'
        }} />
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: 0,
          right: 0,
          textAlign: 'center',
          color: '#FFFFFF',
          fontSize: '0.9rem',
          textShadow: '0 2px 8px rgba(0,0,0,0.8)',
          background: 'rgba(0,0,0,0.5)',
          padding: '8px 16px',
          display: 'inline-block',
          margin: '0 auto',
          borderRadius: '20px',
          width: 'fit-content'
        }}>
          📸 Posicione o comprovante na área indicada
        </div>
      </div>

      <button
        onClick={capturePhoto}
        className="btn-primary"
        disabled={!cameraActive}
        style={{
          marginTop: '20px',
          minWidth: '200px',
          padding: '14px 32px',
          fontSize: '1.1rem'
        }}
      >
        📸 Capturar Comprovante
      </button>
    </div>
  );

  // ===== RENDER PROCESSING STEP =====
  const renderProcessing = () => (
    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
      {capturedImage && (
        <div style={{
          maxWidth: '300px',
          margin: '0 auto 24px',
          borderRadius: '12px',
          overflow: 'hidden',
          border: '2px solid #2A3040'
        }}>
          <img src={capturedImage} alt="Comprovante" style={{ width: '100%', display: 'block' }} />
        </div>
      )}
      <div style={{ marginBottom: '20px' }}>
        <div style={{
          width: '60px',
          height: '60px',
          border: '4px solid #2A3040',
          borderTopColor: '#FF6B00',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 16px'
        }} />
        <h3 style={{ color: '#FFFFFF', margin: '0 0 8px' }}>Lendo comprovante...</h3>
        <p style={{ color: '#6B7280', fontSize: '0.9rem', margin: 0 }}>
          Extraindo informações com OCR
        </p>
      </div>
      <div style={{
        maxWidth: '400px',
        margin: '0 auto',
        background: '#1A1F2E',
        borderRadius: '8px',
        overflow: 'hidden',
        height: '8px'
      }}>
        <div style={{
          width: `${ocrProgress}%`,
          height: '100%',
          background: 'linear-gradient(90deg, #FF6B00, #FF9A2F)',
          borderRadius: '8px',
          transition: 'width 0.3s ease'
        }} />
      </div>
      <p style={{ color: '#6B7280', fontSize: '0.8rem', marginTop: '8px' }}>
        {ocrProgress}%
      </p>
    </div>
  );

  // ===== RENDER CONFIRM STEP =====
  const renderConfirm = () => (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      {/* Photo Preview */}
      {capturedImage && (
        <div style={{
          maxWidth: '250px',
          margin: '0 auto 20px',
          borderRadius: '12px',
          overflow: 'hidden',
          border: '2px solid #2A3040',
          position: 'relative'
        }}>
          <img src={capturedImage} alt="Comprovante" style={{ width: '100%', display: 'block' }} />
          <button
            onClick={retakePhoto}
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              background: 'rgba(0,0,0,0.7)',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 10px',
              color: '#FFFFFF',
              cursor: 'pointer',
              fontSize: '0.8rem'
            }}
          >
            🔄 Refazer
          </button>
        </div>
      )}

      {/* OCR Text */}
      {ocrText && (
        <div style={{
          background: '#1A1F2E',
          borderRadius: '10px',
          padding: '12px 16px',
          marginBottom: '20px',
          border: '1px solid #2A3040'
        }}>
          <div style={{ color: '#6B7280', fontSize: '0.8rem', marginBottom: '4px' }}>
            📝 Texto reconhecido:
          </div>
          <div style={{ color: '#B0B8C8', fontSize: '0.85rem', maxHeight: '80px', overflowY: 'auto' }}>
            {ocrText}
          </div>
        </div>
      )}

      {/* Value */}
      <div className="input-group">
        <label>Valor do Pagamento *</label>
        {detectedValue && (
          <div style={{
            marginBottom: '8px',
            padding: '8px 12px',
            background: 'rgba(0, 230, 118, 0.1)',
            borderRadius: '6px',
            color: '#00E676',
            fontSize: '0.85rem',
            border: '1px solid rgba(0, 230, 118, 0.2)'
          }}>
            🔍 Valor detectado: <strong>R$ {parseFloat(detectedValue).toFixed(2)}</strong>
          </div>
        )}
        <input
          type="number"
          value={manualValue}
          onChange={(e) => setManualValue(e.target.value)}
          placeholder="0,00"
          step="0.01"
          min="0.01"
          required
        />
      </div>

      {/* Client Search */}
      <div className="input-group">
        <label>Cliente *</label>
        {selectedCliente ? (
          <div style={{
            padding: '10px 16px',
            background: 'rgba(0, 230, 118, 0.1)',
            borderRadius: '8px',
            color: '#00E676',
            border: '1px solid rgba(0, 230, 118, 0.2)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>✅ <strong>{selectedCliente.nome_completo}</strong></span>
            <button
              onClick={() => { setSelectedCliente(null); setSearchTerm(''); }}
              style={{
                background: 'rgba(255, 23, 68, 0.15)',
                border: 'none',
                borderRadius: '6px',
                padding: '4px 10px',
                color: '#FF1744',
                cursor: 'pointer',
                fontSize: '0.8rem'
              }}
            >
              Trocar
            </button>
          </div>
        ) : (
          <div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="🔍 Buscar cliente por nome ou CPF..."
              onFocus={() => { if (clientes.length > 0) setShowResults(true); }}
            />
            {showResults && clientes.length > 0 && (
              <div style={{
                background: '#161A22',
                borderRadius: '10px',
                border: '1px solid #2A3040',
                maxHeight: '200px',
                overflowY: 'auto',
                marginTop: '8px'
              }}>
                {clientes.map(cliente => (
                  <div
                    key={cliente.id}
                    onClick={() => {
                      setSelectedCliente(cliente);
                      setSearchTerm(cliente.nome_completo);
                      setShowResults(false);
                    }}
                    style={{
                      padding: '10px 16px',
                      cursor: 'pointer',
                      borderBottom: '1px solid #2A3040',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 107, 0, 0.08)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ fontWeight: '500', color: '#FFFFFF' }}>{cliente.nome_completo}</div>
                    <div style={{ fontSize: '0.85rem', color: '#6B7280' }}>CPF: {cliente.cpf}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Payment Method */}
      <div className="input-group">
        <label>Forma de Pagamento *</label>
        <select
          value={formaPagamento}
          onChange={(e) => setFormaPagamento(e.target.value)}
          required
        >
          <option value="CREDITO">💳 Crédito</option>
          <option value="DEBITO">💳 Débito</option>
          <option value="PIX">📱 PIX</option>
        </select>
      </div>

      {/* Obs */}
      <div className="input-group">
        <label>Observações</label>
        <textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          placeholder="Observações sobre o pagamento..."
          rows="3"
        />
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
        <button
          onClick={handleSubmit}
          className="btn-primary"
          disabled={loading || !selectedCliente}
          style={{ flex: 1, padding: '14px', fontSize: '1rem' }}
        >
          {loading ? '💾 Salvando...' : '💾 Confirmar Pagamento'}
        </button>
        <button
          onClick={retakePhoto}
          className="btn-secondary"
          disabled={loading}
        >
          📸 Nova Foto
        </button>
      </div>
    </div>
  );

  // ===== RENDER RESULT STEP =====
  const renderResult = () => (
    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
      <div style={{
        width: '80px',
        height: '80px',
        borderRadius: '50%',
        background: 'rgba(0, 230, 118, 0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 20px',
        fontSize: '2.5rem'
      }}>
        ✅
      </div>
      <h2 style={{ color: '#00E676', margin: '0 0 8px' }}>Pagamento Registrado!</h2>
      <p style={{ color: '#B0B8C8', margin: '0 0 4px' }}>
        {selectedCliente?.nome_completo}
      </p>
      <p style={{ color: '#FFFFFF', fontSize: '1.5rem', fontWeight: '700', margin: '0 0 24px' }}>
        R$ {parseFloat(manualValue || detectedValue).toFixed(2)}
      </p>
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={() => {
            setStep('camera');
            setCapturedImage(null);
            setOcrText('');
            setDetectedValue('');
            setManualValue('');
            setSelectedCliente(null);
            setSearchTerm('');
            setObservacoes('');
            startCamera();
          }}
          className="btn-primary"
          style={{ padding: '14px 24px' }}
        >
          📸 Novo Pagamento
        </button>
        <button
          onClick={() => navigate('/pagamentos')}
          className="btn-secondary"
          style={{ padding: '14px 24px' }}
        >
          📋 Ver Pagamentos
        </button>
      </div>
    </div>
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {step === 'camera' && '📸 Pagamento Rápido'}
            {step === 'processing' && '⏳ Processando...'}
            {step === 'confirm' && '✅ Confirmar Pagamento'}
            {step === 'result' && '🎉 Pagamento Concluído'}
          </h1>
          <p className="page-subtitle">
            {step === 'camera' && 'Capture o comprovante para registrar o pagamento automaticamente'}
            {step === 'processing' && 'Aguardando leitura do comprovante...'}
            {step === 'confirm' && 'Revise os dados e confirme o pagamento'}
            {step === 'result' && 'Pagamento registrado com sucesso'}
          </p>
        </div>
        {step !== 'result' && (
          <button
            onClick={() => navigate('/pagamentos')}
            className="btn-secondary"
          >
            ↩️ Voltar
          </button>
        )}
      </div>

      <div className="card animate-fade-in">
        {step === 'camera' && renderCamera()}
        {step === 'processing' && renderProcessing()}
        {step === 'confirm' && renderConfirm()}
        {step === 'result' && renderResult()}
      </div>

      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default PagamentoRapido;