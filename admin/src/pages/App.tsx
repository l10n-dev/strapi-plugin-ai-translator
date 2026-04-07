import { Routes, Route } from 'react-router-dom';
import { Page } from '@strapi/strapi/admin';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Dashboard } from './Dashboard';
import { Editor } from './Editor';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="editor/:uid" element={<Editor />} />
        <Route path="*" element={<Page.Error />} />
      </Routes>
    </QueryClientProvider>
  );
};

export { App };
