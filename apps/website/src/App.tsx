import Header from './components/Header';
import Hero from './components/Hero';
import Problem from './components/Problem';
import Features from './components/Features';
import Packages from './components/Packages';
import QuickStart from './components/QuickStart';
import Footer from './components/Footer';

export default function App() {
  return (
    <div
      className="min-h-screen text-white antialiased"
      style={{ background: '#080808', fontFamily: 'DM Sans, system-ui, sans-serif' }}
    >
      <Header />
      <Hero />
      <Problem />
      <Features />
      <Packages />
      <QuickStart />
      <Footer />
    </div>
  );
}
