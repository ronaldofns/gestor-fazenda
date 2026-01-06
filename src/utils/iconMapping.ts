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
  FaEdit,           // Edit
  FaTrash,          // Trash2
  FaChartLine,      // TrendingUp
  FaMars,           // Mars
  FaVenus,          // Venus
  FaFileAlt,        // FileText
  FaSlidersH,       // SlidersHorizontal
  FaHistory,        // History
  FaExclamationTriangle, // AlertTriangle
  FaInfoCircle,     // Info
  FaUserTimes,      // UserX
  FaCheck,          // Check
  FaCheckDouble,    // CheckCheck
  FaUndo,           // RotateCcw
  FaEye,            // Eye
  FaCalendar,       // Calendar
  FaUser,           // User
  FaPaw,            // Ícone de animal (novo)
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
  FaCow            // Cow (se disponível)
} from 'react-icons/fa6';

import { CiLogout } from "react-icons/ci";

// Ícones de animais do Material Design
import {
  MdPets            // Ícone de animais/pets
} from 'react-icons/md';

// Material Design Icons (para alguns ícones específicos)
import {
  MdDashboard,      // Alternativa para LayoutDashboard
  MdUploadFile,     // Alternativa para Upload
  MdDelete,         // Alternativa para Trash2
  MdEdit,           // Alternativa para Edit
  MdHistory,        // Alternativa para History
  MdWarning,        // Alternativa para AlertTriangle
  MdInfo,           // Alternativa para Info
  MdClose,          // Alternativa para X
  MdMenu,           // Alternativa para Menu
  MdSync,           // Alternativa para RefreshCw
  MdDownload,       // Alternativa para Download
  MdSettings,       // Alternativa para Settings
  MdNotifications,  // Alternativa para Bell
  MdChevronLeft,    // Alternativa para ChevronLeft
  MdChevronRight,   // Alternativa para ChevronRight
  MdAdd,            // Alternativa para Plus
  MdBarChart,       // Alternativa para BarChart3
  MdTrendingUp,     // Alternativa para TrendingUp
  MdPerson,         // Alternativa para User
  MdPeople,         // Alternativa para Users
  MdBusiness,       // Alternativa para Building2
  MdDescription,    // Alternativa para FileSpreadsheet
  MdDarkMode,       // Alternativa para Moon
  MdLightMode,      // Alternativa para Sun
  MdMale,           // Alternativa para Mars
  MdFemale,         // Alternativa para Venus
  MdFileDownload,   // Alternativa para FileText
  MdTune,           // Alternativa para SlidersHorizontal
  MdVisibility,     // Alternativa para Eye
  MdEvent,          // Alternativa para Calendar
  MdUndo,           // Alternativa para RotateCcw
  MdCheck,          // Alternativa para Check
  MdCheckCircle,    // Alternativa para CheckCheck
  MdPersonOff,      // Alternativa para UserX
  MdErrorOutline,   // Alternativa para FileWarning
  MdAccountTree,     // Alternativa para ListTree
  MdWifiOff,         // WifiOff
  MdSwapVert         // ArrowUpDown (alternativa)
} from 'react-icons/md';

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
  Edit: FaEdit,
  Trash2: FaTrash,
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
  AlertTriangle: FaExclamationTriangle,
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
  Logout: CiLogout,
  
  // Ícones de Animais (novos)
  Paw: FaPaw,
  Pets: MdPets,
  Cow: FaCow,
  
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
  FilePenLine: FaEdit, // Usando Edit como alternativa
};

// Tipo para garantir type-safety
export type IconName = keyof typeof Icons;
