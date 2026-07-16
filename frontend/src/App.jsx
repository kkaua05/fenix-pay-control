import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { ToastProvider } from './contexts/ToastContext';
import { AuthProvider } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import PrivateRoute from './components/common/PrivateRoute';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Pagamentos from './pages/Pagamentos';
import NovoPagamento from './pages/NovoPagamento';
import DetalhesPagamento from './pages/DetalhesPagamento';
import Usuarios from './pages/Usuarios';
import Relatorios from './pages/Relatorios';
import Auditoria from './pages/Auditoria';
import Clientes from './pages/Clientes';
import GerenciadorArquivos from './pages/GerenciadorArquivos';
// import AutomacaoPortal from './pages/AutomacaoPortal'; // REMOVIDO

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <SocketProvider>
            <Routes>
              {/* Rotas Públicas */}
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              
              {/* Rotas Protegidas */}
              <Route element={<PrivateRoute />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/pagamentos" element={<Pagamentos />} />
                <Route path="/pagamentos/novo" element={<NovoPagamento />} />
                <Route path="/pagamentos/:id" element={<DetalhesPagamento />} />
                <Route path="/usuarios" element={<Usuarios />} />
                <Route path="/relatorios" element={<Relatorios />} />
                <Route path="/auditoria" element={<Auditoria />} />
                <Route path="/clientes" element={<Clientes />} />
                <Route path="/arquivos" element={<GerenciadorArquivos />} />
                <Route path="/arquivos/pagamento/:pagamento_id" element={<GerenciadorArquivos />} />
                {/* <Route path="/automacao" element={<AutomacaoPortal />} /> // REMOVIDO */}
              </Route>
            </Routes>
            
            {/* Toast Container */}
            <ToastContainer 
              position="top-right"
              autoClose={3000}
              hideProgressBar={false}
              newestOnTop
              closeOnClick
              rtl={false}
              pauseOnFocusLoss
              draggable
              pauseOnHover
              theme="dark"
            />
          </SocketProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;