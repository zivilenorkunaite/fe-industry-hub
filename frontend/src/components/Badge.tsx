interface BadgeProps {
  children: React.ReactNode;
  variant?: 'category' | 'tag' | 'role' | 'status' | 'maturity';
  className?: string;
}

const variantStyles: Record<string, string> = {
  category: 'bg-db-blue-light text-db-blue border border-db-blue/20',
  tag: 'bg-gray-100 text-gray-600 border border-gray-200',
  role: 'bg-db-navy text-white',
  status_published: 'bg-green-100 text-green-700 border border-green-200',
  status_draft: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
  maturity_Established: 'bg-green-100 text-green-700',
  maturity_Growing: 'bg-blue-100 text-blue-700',
  maturity_Emerging: 'bg-purple-100 text-purple-700',
};

export function Badge({ children, variant = 'tag', className = '' }: BadgeProps) {
  const key = variant === 'status'
    ? `status_${children}`
    : variant === 'maturity'
    ? `maturity_${children}`
    : variant;
  const styles = variantStyles[key] || variantStyles.tag;
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${styles} ${className}`}>
      {children}
    </span>
  );
}
