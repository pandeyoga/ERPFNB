import { createContext, useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { logger } from "@/lib/logger";

const LoyaltyAuthContext = createContext(null);

const API_URL = process.env.REACT_APP_BACKEND_URL;

export function LoyaltyAuthProvider({ children }) {
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(() => localStorage.getItem("loyalty_token"));

  // Load customer profile on mount if token exists
  useEffect(() => {
    if (token) {
      loadCustomer();
    } else {
      setLoading(false);
    }
  }, [token]);

  const loadCustomer = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/loyalty/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCustomer(response.data);
    } catch (error) {
      logger.error("Failed to load loyalty customer", { error: error.message });
      // Token invalid, clear it
      localStorage.removeItem("loyalty_token");
      setToken(null);
      setCustomer(null);
    } finally {
      setLoading(false);
    }
  };

  const register = async (data) => {
    const response = await axios.post(`${API_URL}/api/loyalty/register`, data);
    const { access_token, customer: customerData } = response.data;
    
    localStorage.setItem("loyalty_token", access_token);
    setToken(access_token);
    setCustomer(customerData);
    
    return customerData;
  };

  const login = async (email, password) => {
    const response = await axios.post(`${API_URL}/api/loyalty/login`, {
      email,
      password,
    });
    const { access_token, customer: customerData } = response.data;
    
    localStorage.setItem("loyalty_token", access_token);
    setToken(access_token);
    setCustomer(customerData);
    
    return customerData;
  };

  const loginByPhone = async (phone, password) => {
    const response = await axios.post(`${API_URL}/api/loyalty/login-phone`, {
      phone,
      password,
    });
    const { access_token, customer: customerData } = response.data;

    localStorage.setItem("loyalty_token", access_token);
    setToken(access_token);
    setCustomer(customerData);

    return customerData;
  };

  const logout = () => {
    localStorage.removeItem("loyalty_token");
    setToken(null);
    setCustomer(null);
  };

  const refreshCustomer = async () => {
    if (token) {
      await loadCustomer();
    }
  };

  const value = {
    customer,
    loading,
    token,
    register,
    login,
    loginByPhone,
    logout,
    refreshCustomer,
    isAuthenticated: !!customer,
  };

  return (
    <LoyaltyAuthContext.Provider value={value}>
      {children}
    </LoyaltyAuthContext.Provider>
  );
}

export function useLoyaltyAuth() {
  const context = useContext(LoyaltyAuthContext);
  if (!context) {
    throw new Error("useLoyaltyAuth must be used within LoyaltyAuthProvider");
  }
  return context;
}
