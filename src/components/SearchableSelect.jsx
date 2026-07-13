import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown } from 'lucide-react';

export const SearchableSelect = ({ 
  options = [], 
  value, 
  onChange, 
  placeholder = "Selecione...",
  hasError = false,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef(null);
  
  // Close dropdown if clicked outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm(''); // Reset search on close
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt => 
    opt.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (opt) => {
    onChange(opt);
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      <div 
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.75rem 1rem',
          backgroundColor: disabled ? '#f3f4f6' : (isOpen ? '#fff' : '#f9fafb'),
          border: `1px solid ${hasError ? '#ef4444' : (isOpen ? '#10b981' : '#d1d5db')}`,
          borderRadius: '8px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          color: value ? '#111827' : '#6b7280',
          transition: 'all 0.2s',
          fontSize: '0.9rem',
          outline: isOpen ? '2px solid rgba(16, 185, 129, 0.2)' : 'none'
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value || placeholder}
        </span>
        <ChevronDown size={16} style={{ color: '#6b7280', transform: isOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }} />
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: '0.25rem',
          backgroundColor: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          zIndex: 50,
          maxHeight: '250px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ padding: '0.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Search size={16} style={{ color: '#9ca3af', marginLeft: '0.25rem' }} />
            <input 
              type="text"
              autoFocus
              placeholder="Pesquisar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                border: 'none',
                outline: 'none',
                width: '100%',
                fontSize: '0.85rem',
                color: '#111827',
                padding: '0.25rem 0'
              }}
            />
          </div>
          
          <div style={{ overflowY: 'auto', flex: 1, padding: '0.25rem' }}>
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt, index) => (
                <div 
                  key={index}
                  onClick={() => handleSelect(opt)}
                  style={{
                    padding: '0.5rem 0.75rem',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    color: '#374151',
                    borderRadius: '4px',
                    transition: 'background-color 0.1s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  {opt}
                </div>
              ))
            ) : (
              <div style={{ padding: '1rem', textAlign: 'center', color: '#6b7280', fontSize: '0.85rem' }}>
                Nenhum resultado encontrado
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
