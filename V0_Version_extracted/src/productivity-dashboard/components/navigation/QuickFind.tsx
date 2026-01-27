// QuickFind - Command palette for quick navigation
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useDashboard } from '../../hooks/useDashboardContext';
import { getAllNavItems, NavItem } from './navStructure';
import './navigation.css';

export interface QuickFindProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (route: string) => void;
}

interface SearchResult {
  type: 'navigation' | 'recruiter' | 'requisition' | 'action';
  id: string;
  label: string;
  sublabel?: string;
  route: string;
  icon: string;
}

export function QuickFind({ isOpen, onClose, onNavigate }: QuickFindProps) {
  const [query, setQuery] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get dashboard data for searching recruiters/reqs
  const { state } = useDashboard();
  const { dataStore } = state;
  const { users, requisitions } = dataStore;

  // Build search index
  const searchIndex = useMemo(() => {
    const results: SearchResult[] = [];

    // Add navigation items
    getAllNavItems().forEach(item => {
      results.push({
        type: 'navigation',
        id: `nav-${item.id}`,
        label: item.label,
        route: item.route,
        icon: item.icon || 'bi-arrow-right'
      });
    });

    // Add recruiters
    users.forEach(user => {
      if (user.role === 'Recruiter') {
        const reqCount = requisitions.filter(r => r.recruiter_id === user.user_id).length;
        results.push({
          type: 'recruiter',
          id: `recruiter-${user.user_id}`,
          label: user.name,
          sublabel: `${reqCount} reqs`,
          route: `/diagnose/recruiter/${user.user_id}`,
          icon: 'bi-person'
        });
      }
    });

    // Add requisitions (limit to first 100 for performance)
    requisitions.slice(0, 100).forEach(req => {
      results.push({
        type: 'requisition',
        id: `req-${req.req_id}`,
        label: req.req_id,
        sublabel: req.req_title || undefined,
        route: `/diagnose/recruiter?req=${req.req_id}`,
        icon: 'bi-file-text'
      });
    });

    // Add common actions
    results.push({
      type: 'action',
      id: 'action-import',
      label: 'Import Data',
      route: '/?action=import',
      icon: 'bi-upload'
    });

    return results;
  }, [users, requisitions]);

  // Filter results based on query
  const filteredResults = useMemo(() => {
    if (!query.trim()) {
      // Show navigation items by default
      return searchIndex.filter(r => r.type === 'navigation').slice(0, 10);
    }

    const lowerQuery = query.toLowerCase();
    return searchIndex
      .filter(r => {
        const labelMatch = r.label.toLowerCase().includes(lowerQuery);
        const sublabelMatch = r.sublabel?.toLowerCase().includes(lowerQuery);
        return labelMatch || sublabelMatch;
      })
      .slice(0, 15);
  }, [query, searchIndex]);

  // Group results by type
  const groupedResults = useMemo(() => {
    const groups: Record<string, SearchResult[]> = {
      navigation: [],
      recruiter: [],
      requisition: [],
      action: []
    };

    filteredResults.forEach(r => {
      if (groups[r.type]) {
        groups[r.type].push(r);
      }
    });

    return groups;
  }, [filteredResults]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setFocusedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Handle navigation via callback
  const handleNavigate = useCallback((route: string) => {
    if (onNavigate) {
      onNavigate(route);
    }
    onClose();
  }, [onNavigate, onClose]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev => Math.min(prev + 1, filteredResults.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredResults[focusedIndex]) {
          handleNavigate(filteredResults[focusedIndex].route);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [filteredResults, focusedIndex, handleNavigate, onClose]);

  const handleResultClick = (result: SearchResult) => {
    handleNavigate(result.route);
  };

  const getTypeLabel = (type: string): string => {
    switch (type) {
      case 'navigation': return 'NAVIGATION';
      case 'recruiter': return 'RECRUITERS';
      case 'requisition': return 'REQUISITIONS';
      case 'action': return 'ACTIONS';
      default: return type.toUpperCase();
    }
  };

  if (!isOpen) return null;

  let currentIndex = 0;

  return (
    <>
      {/* Backdrop */}
      <div className="quickfind-backdrop" onClick={onClose} />

      {/* Modal */}
      <div className="quickfind-modal" role="dialog" aria-modal="true" aria-label="Quick Find">
        {/* Search input */}
        <div className="quickfind-header">
          <i className="bi bi-search quickfind-icon" />
          <input
            ref={inputRef}
            type="text"
            className="quickfind-input"
            placeholder="Quick Find..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setFocusedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            autoComplete="off"
          />
          <button className="quickfind-close" onClick={onClose} aria-label="Close">
            <span className="quickfind-esc">Esc</span>
          </button>
        </div>

        {/* Results */}
        <div className="quickfind-results">
          {filteredResults.length === 0 ? (
            <div className="quickfind-empty">
              No results found
            </div>
          ) : (
            Object.entries(groupedResults).map(([type, results]) => {
              if (results.length === 0) return null;

              return (
                <div key={type} className="quickfind-group">
                  <div className="quickfind-group-header">
                    {getTypeLabel(type)}
                  </div>
                  {results.map((result) => {
                    const itemIndex = currentIndex++;
                    return (
                      <button
                        key={result.id}
                        className={`quickfind-item ${focusedIndex === itemIndex ? 'focused' : ''}`}
                        onClick={() => handleResultClick(result)}
                        onMouseEnter={() => setFocusedIndex(itemIndex)}
                      >
                        <i className={`bi ${result.icon} quickfind-item-icon`} />
                        <div className="quickfind-item-text">
                          <span className="quickfind-item-label">{result.label}</span>
                          {result.sublabel && (
                            <span className="quickfind-item-sublabel">{result.sublabel}</span>
                          )}
                        </div>
                        <i className="bi bi-arrow-return-left quickfind-item-enter" />
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div className="quickfind-footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> select</span>
          <span><kbd>esc</kbd> close</span>
        </div>
      </div>
    </>
  );
}

export default QuickFind;
