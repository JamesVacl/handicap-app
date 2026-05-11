import { useState, useEffect, useRef } from 'react';
import { Nav, Button } from 'react-bootstrap';
import { useRouter } from 'next/router';
import Link from 'next/link';

const FloatingNavigation = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [hasMoved, setHasMoved] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isMobile, setIsMobile] = useState(false);
  const navRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    // Check if mobile
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);

    const handleScroll = () => {
      const scrolled = window.scrollY > 100; // Reduced threshold
      setIsVisible(scrolled);
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  const handleDragStart = (clientX, clientY, rect) => {
    if (!hasMoved) {
      setHasMoved(true);
      setPosition({ x: rect.left, y: rect.top });
    }
    setIsDragging(true);
    setDragOffset({
      x: clientX - rect.left,
      y: clientY - rect.top
    });
  };

  const handleMouseDown = (e) => {
    e.preventDefault();
    handleDragStart(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect());
  };

  const handleTouchStart = (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    handleDragStart(touch.clientX, touch.clientY, e.currentTarget.getBoundingClientRect());
  };

  const updatePosition = (clientX, clientY) => {
    const newX = clientX - dragOffset.x;
    const newY = clientY - dragOffset.y;
    
    const navWidth = navRef.current ? navRef.current.offsetWidth : 350;
    const navHeight = navRef.current ? navRef.current.offsetHeight : 80;
    
    // Use document.documentElement.clientWidth to avoid scrollbar bounds issues
    const maxX = document.documentElement.clientWidth - navWidth;
    const maxY = document.documentElement.clientHeight - navHeight;
    
    setPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY))
    });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    updatePosition(e.clientX, e.clientY);
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    updatePosition(e.touches[0].clientX, e.touches[0].clientY);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [isDragging, dragOffset, hasMoved]);

  const navItems = [
    { href: '/', label: 'Handicap', icon: '📊' },
    { href: '/teams', label: 'Teams', icon: '👥' },
    { href: '/schedule', label: 'Schedule', icon: '📅' },
    { href: '/results', label: 'Results', icon: '🏆' }
  ];

  // Don't render until visible
  if (!isVisible) return null;

  const style = hasMoved ? {
    left: `${position.x}px`,
    top: `${position.y}px`,
    cursor: isDragging ? 'grabbing' : 'grab'
  } : {
    ...(isMobile ? {
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)'
    } : {
      top: '100px',
      right: '20px'
    }),
    cursor: isDragging ? 'grabbing' : 'grab'
  };

  return (
    <div 
      ref={navRef}
      className="floating-navigation"
      style={style}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      <div className="floating-nav-container">
        <div className="drag-handle">⋮⋮</div>
        {navItems.map((item) => (
          <Link key={item.href} href={item.href} passHref legacyBehavior>
            <Nav.Link 
              className={`floating-nav-item ${router.pathname === item.href ? 'active' : ''}`}
              title={item.label}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </Nav.Link>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default FloatingNavigation; 