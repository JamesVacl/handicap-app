import { Analytics } from '@vercel/analytics/react';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../styles/globals.css';
import CountdownBar from 'src/components/CountdownBar';
import BackgroundSlideshow from 'src/components/BackgroundSlideshow';

export default function App({ Component, pageProps }) {
  return (
    <>
      <BackgroundSlideshow />
      <div className="overlay"></div>
      <Component {...pageProps} />
      <CountdownBar />
      <Analytics />
    </>
  );
}
