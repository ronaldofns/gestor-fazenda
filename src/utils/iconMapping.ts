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
  FaChevronUp,      // ChevronUp / ArrowUp
  FaArrowLeft,      // ArrowLeft
  FaFilter,         // Filter
  FaPlus,           // Plus
  FaMinus,          // Minus
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
  FaChevronDown,    // ChevronDown
  FaStar,           // Star
  FaEnvelope,       // Mail
  FaHeart,          // Heart
  FaAward,          // Award
  FaLock,           // Lock
  FaSignInAlt,      // LogIn
  FaUserPlus,       // UserCheck / UserPlus
  FaWifi,           // Wifi
  FaCheckCircle,    // CheckCircle
  FaExclamationCircle, // AlertCircle / XCircle
  FaSort,           // ArrowUpDown (alternativa)
  FaShieldAlt,      // Shield
  FaSpinner,        // Loader2
  FaBaby,           // Baby
  FaBalanceScale,   // Scale
  FaTag,            // Tag
  FaFolder,         // Folder
  FaClock,          // Clock
  FaPalette,        // Palette
  FaPaintBrush,      // Paintbrush (alternativa para Palette)
  FaCheckSquare,     // CheckSquare
  FaSquare,          // Square
  FaMapMarkerAlt,    // MapPin
  FaCompass,         // Navigation
  FaKeyboard,        // Keyboard
  FaBolt,            // Zap
  FaDesktop,         // Monitor
  FaSave,            // Save
  FaPlay,            // Play
  FaInbox,           // Inbox
  FaChartBar,        // BarChart / Activity
  FaSearch,          // Search
  FaCodeBranch,      // GitBranch
  FaDollarSign,      // DollarSign
  FaList             // List
} from 'react-icons/fa';

// Font Awesome 6 (para ícones mais recentes)
import { 
  FaCow            // Cow (se disponível)
} from 'react-icons/fa6';

// Game Icons
import { GiCow } from 'react-icons/gi';

// Material Design Icons (para alguns ícones específicos)
import {
  MdBarChart,       // BarChart3
  MdWifiOff         // WifiOff
} from 'react-icons/md';

// Boxicons Solid (para ícones específicos)
import {
  BiSolidInjection  // Injection (vacinação)
} from 'react-icons/bi';


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
  ChevronUp: FaChevronUp,
  ArrowUp: FaChevronUp,
  ArrowDown: FaChevronDown,
  ArrowLeft: FaArrowLeft,
  Filter: FaFilter,
  
  // Ações
  Plus: FaPlus,
  Minus: FaMinus,
  Edit: FaEdit,
  Trash2: FaTrash,
  Trash: FaTrash,
  History: FaHistory,
  Save: FaSave,
  Play: FaPlay,
  
  // Gráficos e Estatísticas
  TrendingUp: FaChartLine,
  TrendingDown: FaChartLine, // Usando o mesmo ícone, mas pode ser rotacionado com CSS
  BarChart3: MdBarChart,
  BarChart: FaChartBar,
  Activity: FaChartBar,
  
  // Gênero
  Mars: FaMars,
  Venus: FaVenus,
  
  // Documentos
  FileText: FaFileAlt,
  
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
  
  // Ícones de Animais
  Cow: GiCow,        // Alias para compatibilidade
  Vaca: GiCow,
  Novilha: GiCow,
  // Ícones adicionais
  ChevronDown: FaChevronDown,
  Star: FaStar,
  Mail: FaEnvelope,
  Heart: FaHeart,
  Award: FaAward,
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
  Shield: FaShieldAlt,
  Injection: BiSolidInjection, // Ícone de vacinação/injeção
  Loader2: FaSpinner,
  Baby: FaBaby,
  Scale: FaBalanceScale,
  Tag: FaTag,
  Folder: FaFolder,
  Clock: FaClock,
  Palette: FaPalette,
  Paintbrush: FaPaintBrush,
  CheckSquare: FaCheckSquare,
  Square: FaSquare,
  MapPin: FaMapMarkerAlt,
  Navigation: FaCompass,
  Keyboard: FaKeyboard,
  Zap: FaBolt,
  Monitor: FaDesktop,
  Inbox: FaInbox,
  Search: FaSearch,
  GitBranch: FaCodeBranch,
  DollarSign: FaDollarSign,
  List: FaList
};

// Tipo para garantir type-safety
export type IconName = keyof typeof Icons;

