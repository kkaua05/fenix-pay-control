import { createContext } from 'react';
import { toast } from 'react-toastify';

// Criar o contexto
const ToastContext = createContext();

// Provider component
export const ToastProvider = ({ children }) => {
  const showToast = (message, type = 'info') => {
    switch (type) {
      case 'success':
        toast.success(message);
        break;
      case 'error':
        toast.error(message);
        break;
      case 'warning':
        toast.warning(message);
        break;
      default:
        toast.info(message);
    }
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
    </ToastContext.Provider>
  );
};

// Exportar o contexto para uso no hook
export { ToastContext };