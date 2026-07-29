import React, { useState, useEffect, useId } from 'react';
import { ChevronDown } from 'react-feather';

/**
 * CollapsiblePanel – wraps children in a collapsible container with a header toggle.
 *
 * On desktop (≥641px), the panel is always expanded and the toggle is hidden.
 * On mobile (<641px), it defaults to collapsed so the chessboard takes full focus.
 *
 * Props:
 *  - title: header text
 *  - icon: React element rendered next to the title
 *  - defaultExpanded: override default (defaults to !isMobile)
 *  - gridArea: CSS grid-area value for positioning within a grid parent
 *  - children: panel content
 *  - className: extra class on the wrapper
 */
const MOBILE_BREAKPOINT = 640;

const CollapsiblePanel = ({ title, icon, defaultExpanded, gridArea, children, className = '' }) => {
  const autoId = useId();
  const contentId = `cp-content-${autoId}`;

  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= MOBILE_BREAKPOINT;
  });

  const [isExpanded, setIsExpanded] = useState(() => {
    if (typeof window === 'undefined') return true;
    if (defaultExpanded !== undefined) return defaultExpanded;
    return window.innerWidth > MOBILE_BREAKPOINT;
  });

  // Sync mobile state on resize so the toggle shows/hides correctly
  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth <= MOBILE_BREAKPOINT;
      setIsMobile(mobile);
      // Auto-expand when crossing back to desktop
      if (!mobile) setIsExpanded(true);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const toggle = () => setIsExpanded((prev) => !prev);

  return (
    <div
      className={`collapsible-panel ${className}${isExpanded ? ' cp-expanded' : ''}${!isMobile ? ' cp-desktop' : ''}`}
      style={gridArea ? { gridArea } : undefined}
    >
      <button
        className="cp-toggle"
        onClick={toggle}
        aria-expanded={isExpanded}
        aria-controls={contentId}
        type="button"
      >
        <span className="cp-toggle-icon" aria-hidden="true">{icon}</span>
        <span className="cp-toggle-title">{title}</span>
        <ChevronDown
          size={20}
          className={`cp-chevron${isExpanded ? ' cp-chevron-open' : ''}`}
          aria-hidden="true"
        />
      </button>
      <div
        id={contentId}
        className="cp-content"
        role="region"
        aria-label={title}
      >
        {children}
      </div>
    </div>
  );
};

export default CollapsiblePanel;
