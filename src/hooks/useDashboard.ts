import { useEffect, useState } from 'react';
import { dashboardService } from '../services/dashboardService';

export function useDashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({});

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      const result = await dashboardService.getDashboardData();

      if (isMounted) {
        setData(result);
        setLoading(false);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  return { loading, data };
}
