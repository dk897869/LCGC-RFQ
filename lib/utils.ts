export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function formatCurrency(value: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(value);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d);
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function getStatusColor(status: string): 'success' | 'warning' | 'destructive' | 'muted' {
  switch (status?.toLowerCase()) {
    case 'approved':
    case 'completed':
    case 'active':
      return 'success';
    case 'pending':
    case 'draft':
      return 'warning';
    case 'rejected':
    case 'cancelled':
      return 'destructive';
    default:
      return 'muted';
  }
}

export function truncate(str: string, length: number): string {
  return str.length > length ? `${str.substring(0, length)}...` : str;
}
