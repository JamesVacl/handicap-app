import { Analytics } from '@vercel/analytics/react';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../styles/globals.css';
import CountdownBar from 'src/components/CountdownBar';

export default function App({ Component, pageProps }) {
  return (
    <>
      <Component {...pageProps} />
      <CountdownBar />
      <Analytics />
    </>
  );
}
