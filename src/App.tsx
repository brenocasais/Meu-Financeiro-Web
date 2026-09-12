import React from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { FinanceProvider } from './context/FinanceContext';
import { AppLayout } from './components/layout/AppLayout';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <FinanceProvider>
          <AppLayout />
        </FinanceProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
