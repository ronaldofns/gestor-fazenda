/**
 * Mapeamento de ícones do Lucide React para React Icons
 * 
 * Este arquivo centraliza o mapeamento para facilitar a migração
 * e permitir fácil substituição futura se necessário.
 */

// Font Awesome
import { 
  FaHome,           // LayoutDashboard
  FaFileExcel,      // FileSpreadsheet
  FaBuilding,       // Building2
  FaUpload,         // Upload
  FaSignOutAlt,     // LogOut
  FaBars,           // Menu
  FaTimes,          // X
  FaSync,           // RefreshCw
  FaUsers,          // Users
  FaDownload,       // Download
  FaCog,            // Settings
  FaBell,           // Bell
  FaSitemap,        // ListTree
  FaMoon,           // Moon
  FaSun,            // Sun
  FaChevronLeft,    // ChevronLeft
  FaChevronRight,   // ChevronRight
  FaPlus,           // Plus
  FaRegEdit,        // Edit
  FaRegTrashAlt,    // Trash2
  FaChartLine,      // TrendingUp
  FaMars,           // Mars
  FaVenus,          // Venus
  FaFileAlt,        // FileText
  FaSlidersH,       // SlidersHorizontal
  FaHistory,        // History
  FaInfoCircle,     // Info
  FaUserTimes,      // UserX
  FaCheck,          // Check
  FaCheckDouble,    // CheckCheck
  FaUndo,           // RotateCcw
  FaEye,            // Eye
  FaCalendar,       // Calendar
  FaUser,           // User
  FaChevronDown,    // ChevronDown
  FaStar,           // Star
  FaEnvelope,       // Mail
  FaLock,           // Lock
  FaSignInAlt,      // LogIn
  FaUserPlus,       // UserCheck / UserPlus
  FaWifi,           // Wifi
  FaCheckCircle,    // CheckCircle
  FaExclamationCircle, // AlertCircle / XCircle
  FaSort            // ArrowUpDown (alternativa)
} from 'react-icons/fa';

// Font Awesome 6 (para ícones mais recentes)
import { 
  FaCow,           // Cow
  FaSkullCrossbones, // SkullCrossbones
} from 'react-icons/fa6';

// Material Design Icons (para alguns ícones específicos)
import {  
  MdBarChart,       // Alternativa para BarChart3
  MdWifiOff,         // WifiOff
} from 'react-icons/md';
import { GoAlert } from "react-icons/go";
import { GiCow } from "react-icons/gi";
// Exportar mapeamento principal usando Font Awesome (mais completo)
export const Icons = {
  // Navegação e Layout
  LayoutDashboard: FaHome,
  FileSpreadsheet: FaFileExcel,
  Building2: FaBuilding,
  Upload: FaUpload,
  LogOut: FaSignOutAlt,
  Menu: FaBars,
  X: FaTimes,
  RefreshCw: FaSync,
  Users: FaUsers,
  Download: FaDownload,
  Settings: FaCog,
  Bell: FaBell,
  ListTree: FaSitemap,
  Moon: FaMoon,
  Sun: FaSun,
  ChevronLeft: FaChevronLeft,
  ChevronRight: FaChevronRight,
  
  // Ações
  Plus: FaPlus,
  Edit: FaRegEdit,
  Trash2: FaRegTrashAlt,
  History: FaHistory,
  
  // Gráficos e Estatísticas
  TrendingUp: FaChartLine,
  BarChart3: MdBarChart,
  
  // Gênero
  Mars: FaMars,
  Venus: FaVenus,
  
  // Documentos
  FileText: FaFileAlt,
  FileSpreadsheetIcon: FaFileExcel,
  
  // Controles
  SlidersHorizontal: FaSlidersH,
  
  // Alertas e Status
  AlertTriangle: GoAlert,
  Info: FaInfoCircle,
  FileWarning: FaExclamationCircle,
  UserX: FaUserTimes,
  Check: FaCheck,
  CheckCheck: FaCheckDouble,
  
  // Outros
  RotateCcw: FaUndo,
  Eye: FaEye,
  Calendar: FaCalendar,
  User: FaUser,
  Skull: FaSkullCrossbones,
  
  // Ícones de Animais
  Cow: FaCow,
  GiCow: GiCow,
  
  // Ícones adicionais
  ChevronDown: FaChevronDown,
  Star: FaStar,
  Mail: FaEnvelope,
  Lock: FaLock,
  LogIn: FaSignInAlt,
  UserCheck: FaUserPlus,
  UserPlus: FaUserPlus,
  Wifi: FaWifi,
  WifiOff: MdWifiOff,
  CheckCircle: FaCheckCircle,
  AlertCircle: FaExclamationCircle,
  XCircle: FaExclamationCircle,
  ArrowUpDown: FaSort,
  FilePenLine: FaRegEdit, // Usando Edit como alternativa
};

// Tipo para garantir type-safety
export type IconName = keyof typeof Icons;
