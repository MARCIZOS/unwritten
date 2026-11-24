import { createContext, useContext } from 'react';
import { useDeviceModel } from './useDeviceModel';

const DeviceContext = createContext(null);

export function DeviceProvider({ children }) {
  const device = useDeviceModel();
  return <DeviceContext.Provider value={device}>{children}</DeviceContext.Provider>;
}

export const useDevice = () => useContext(DeviceContext);
