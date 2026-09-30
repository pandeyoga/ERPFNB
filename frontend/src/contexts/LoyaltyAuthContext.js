import { createContext, useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { logger } from "@/lib/logger";

const LoyaltyAuthContext = createContext(null);

const API_URL = process.env.REACT_APP_BACKEND_URL;

export function LoyaltyAuthProvider({ children }) {
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  // FE-06: session is an httpOnly cookie; `token` is only a "logged in" marker for pages
  const [token, setToken] = useState(null);

  useEffect(() => {
    localStorage.removeItem("loyalty_token");
    loadCustomer();
  }, []);

  const loadCustomer = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/loyalty/me`, { withCredentials: true });
      setCustomer(response.data);
      setToken("cookie");
    } catch (error) {
      setToken(null);
      setCustomer(null);
    } finally {
      setLoading(false);
    }
  };

  const register = async (data) => {
    const response = await axios.post(`${API_URL}/api/loyalty/register`, data, { withCredentials: true });
    const { customer: customerData } = response.data;
    setToken("cookie");
    setCustomer(customerData);
    
    return customerData;
  };

  const login = async (email, password) => {
    const response = await axios.post(`${API_URL}/api/loyalty/login`, {
      email,
      password,
    }, { withCredentials: true });
    const { customer: customerData } = response.data;
    setToken("cookie");
    setCustomer(customerData);
    
    return customerData;
  };

  const loginByPhone = async (phone, password) => {
    const response = await axios.post(`${API_URL}/api/loyalty/login-phone`, {
      phone,
      password,
    }, { withCredentials: true });
    const { customer: customerData } = response.data;
    setToken("cookie");
    setCustomer(customerData);

    return customerData;
  };

  const logout = () => {
    axios.post(`${API_URL}/api/loyalty/logout`, null, { withCredentials: true }).catch(() => {});
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
