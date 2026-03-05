import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  hover?: boolean;
}

export function Card({ children, onClick, className = '', hover = false }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`
        bg-white rounded-xl border border-gray-200 shadow-sm p-5
        ${hover ? 'cursor-pointer hover:shadow-md hover:border-db-blue/40 transition-all duration-150' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
