import {
  LayoutDashboard, Users, ReceiptText, Wallet, PanelLeftClose, PanelLeftOpen,
  LogOut, ShieldCheck, UserRound, ArrowUpRight, ArrowRight, ArrowLeft, Plus,
  Search, SlidersHorizontal, ChevronLeft, ChevronRight, ChevronDown, Eye,
  EyeOff, LockKeyhole, Mail, Upload, FileText, X, Check, CircleCheck,
  CircleAlert, Inbox, RefreshCw, CalendarDays, CreditCard, Clock, MoreHorizontal,
  Pencil, Banknote, UserPlus, ArrowDownLeft, FolderOpen, Camera, Trash2,
} from 'lucide';
import { esc } from '../core/dom.js';

const icons = {
  'layout-dashboard': LayoutDashboard, users: Users, 'receipt-text': ReceiptText,
  wallet: Wallet, 'panel-left-close': PanelLeftClose, 'panel-left-open': PanelLeftOpen,
  'log-out': LogOut, 'shield-check': ShieldCheck, 'user-round': UserRound,
  'arrow-up-right': ArrowUpRight, 'arrow-right': ArrowRight, 'arrow-left': ArrowLeft,
  plus: Plus, search: Search, 'sliders-horizontal': SlidersHorizontal,
  'chevron-left': ChevronLeft, 'chevron-right': ChevronRight, 'chevron-down': ChevronDown,
  eye: Eye, 'eye-off': EyeOff, 'lock-keyhole': LockKeyhole, lock: LockKeyhole, mail: Mail,
  upload: Upload, 'file-text': FileText, x: X, check: Check, 'check-circle': CircleCheck,
  'circle-check': CircleCheck, 'alert-circle': CircleAlert, 'circle-alert': CircleAlert,
  inbox: Inbox, 'refresh-cw': RefreshCw, 'calendar-days': CalendarDays,
  'credit-card': CreditCard, clock: Clock, 'more-horizontal': MoreHorizontal,
  pencil: Pencil, banknote: Banknote, 'user-plus': UserPlus, 'arrow-down-left': ArrowDownLeft,
  'folder-open': FolderOpen, camera: Camera, 'trash-2': Trash2,
};
/** Ícones decorativos: os controles precisam de rótulo textual ou aria-label próprio. */
export function icon(name, size = 18) {
  const nodes = icons[name] ?? FileText;
  return `<svg class="icon" width="${Number(size) || 18}" height="${Number(size) || 18}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${nodes.map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([key, value]) => `${key}="${esc(value)}"`).join(' ')} />`).join('')}</svg>`;
}
