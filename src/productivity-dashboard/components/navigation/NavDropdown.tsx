// NavDropdown - Dropdown menu for navigation buckets with submenus
import React, { useState, useRef, useEffect } from 'react';
import { NavItem } from './navStructure';
import './navigation.css';

export interface NavDropdownProps {
  label: string;
  icon: string;
  items: NavItem[];
  isActive: boolean;
  activeItem: string | null;
  onNavigate?: (route: string) => void;
}

export function NavDropdown({ label, icon, items, isActive, activeItem, onNavigate }: NavDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleNavigate = (route: string) => {
    if (onNavigate) {
      onNavigate(route);
    }
  };

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setFocusedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
        setFocusedIndex(0);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev => (prev + 1) % items.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => (prev - 1 + items.length) % items.length);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < items.length) {
          handleNavigate(items[focusedIndex].route);
          setIsOpen(false);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setFocusedIndex(-1);
        break;
      case 'Tab':
        setIsOpen(false);
        setFocusedIndex(-1);
        break;
    }
  };

  const handleItemClick = (item: NavItem) => {
    handleNavigate(item.route);
    setIsOpen(false);
  };

  return (
    <div
      className={`nav-dropdown ${isOpen ? 'open' : ''} ${isActive ? 'active' : ''}`}
      ref={dropdownRef}
      onKeyDown={handleKeyDown}
    >
      <button
        className="nav-dropdown-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <i className={`bi ${icon}`} />
        <span>{label}</span>
        <i className={`bi bi-chevron-${isOpen ? 'up' : 'down'} dropdown-chevron`} />
      </button>

      {isOpen && (
        <div className="nav-dropdown-menu" role="menu">
          {items.map((item, index) => (
            <button
              key={item.id}
              className={`nav-dropdown-item ${activeItem === item.id ? 'active' : ''} ${focusedIndex === index ? 'focused' : ''}`}
              onClick={() => handleItemClick(item)}
              role="menuitem"
              tabIndex={-1}
            >
              {activeItem === item.id && <i className="bi bi-check2 item-check" />}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default NavDropdown;
