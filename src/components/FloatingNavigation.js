import { useState, useEffect, useRef } from 'react';
import { Nav, Button } from 'react-bootstrap';
import { useRouter } from 'next/router';
import Link from 'next/link';

const FloatingNavigation = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
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

  // Separate effect for initial positioning to ensure proper timing
  useEffect(() => {
    const setInitialPosition = () => {
      // Use estimated dimensions if ref is not available yet
      const navWidth = 300;
      const navHeight = 80;
      
      let initialPosition;
      if (isMobile) {
        // Mobile: bottom left with proper bounds checking
        initialPosition = {
          x: Math.max(10, Math.min(20, window.innerWidth - navWidth - 10)),
          y: Math.max(10, window.innerHeight - navHeight - 20)
        };
      } else {
        // Desktop: top right with proper bounds checking
        initialPosition = {
          x: Math.max(10, window.innerWidth - navWidth - 20),
          y: Math.max(10, Math.min(100, window.innerHeight - navHeight - 10))
        };
      }
      
      setPosition(initialPosition);
    };

    // Set initial position immediately, then refine after render
    setInitialPosition();
    
    // Refine position after component renders
    const timer = setTimeout(() => {
      if (navRef.current) {
        const navRect = navRef.current.getBoundingClientRect();
        const navWidth = navRect.width;
        const navHeight = navRect.height;
        
        let refinedPosition;
        if (isMobile) {
          refinedPosition = {
            x: Math.max(10, Math.min(20, window.innerWidth - navWidth - 10)),
            y: Math.max(10, window.innerHeight - navHeight - 20)
          };
        } else {
          refinedPosition = {
            x: Math.max(10, window.innerWidth - navWidth - 20),
            y: Math.max(10, Math.min(100, window.innerHeight - navHeight - 10))
          };
        }
        
        setPosition(refinedPosition);
      }
    }, 100);
    
    return () => clearTimeout(timer);
  }, [isMobile]);

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    const rect = e.currentTarget.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  const handleTouchStart = (e) => {
    e.preventDefault();
    setIsDragging(true);
    const rect = e.currentTarget.getBoundingClientRect();
    const touch = e.touches[0];
    setDragOffset({
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top
    });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    
    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;
    
    // Keep within viewport bounds
    const maxX = window.innerWidth - 300; // Approximate nav width
    const maxY = window.innerHeight - 80; // Approximate nav height
    
    setPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY))
    });
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    
    const touch = e.touches[0];
    const newX = touch.clientX - dragOffset.x;
    const newY = touch.clientY - dragOffset.y;
    
    // Keep within viewport bounds
    const maxX = window.innerWidth - 300;
    const maxY = window.innerHeight - 80;
    
    setPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY))
    });
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
  }, [isDragging, dragOffset]);

  const navItems = [
    { href: '/', label: 'Handicap', icon: '📊' },
    { href: '/schedule', label: 'Schedule', icon: '📅' },
    { href: '/teams', label: 'Teams', icon: '👥' },
    { href: '/results', label: 'Results', icon: '🏆' }
  ];

  // Don't render until we have a valid position to prevent off-screen issues
  if (!isVisible || (position.x === 0 && position.y === 0)) return null;

  return (
    <div 
      ref={navRef}
      className="floating-navigation"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        cursor: isDragging ? 'grabbing' : 'grab'
      }}
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