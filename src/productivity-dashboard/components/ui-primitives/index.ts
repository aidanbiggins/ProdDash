/**
 * UI Primitives
 * Tailwind-based component library matching V0 reference design
 */

// Utility
export { cn } from './utils';

// Button
export { Button } from './Button';
export type { ButtonProps } from './Button';

// Badge
export { Badge } from './Badge';
export type { BadgeProps } from './Badge';

// Card
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from './Card';
export type {
  CardProps,
  CardHeaderProps,
  CardTitleProps,
  CardDescriptionProps,
  CardContentProps,
  CardFooterProps,
} from './Card';

// Table
export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from './Table';
export type {
  TableProps,
  TableHeaderProps,
  TableBodyProps,
  TableFooterProps,
  TableHeadProps,
  TableRowProps,
  TableCellProps,
  TableCaptionProps,
} from './Table';

// Input
export { Input } from './Input';
export type { InputProps } from './Input';

// Select
export { Select } from './Select';
export type { SelectProps } from './Select';

// Tabs
export { Tabs, TabsList, TabsTrigger, TabsContent } from './Tabs';
export type {
  TabsProps,
  TabsListProps,
  TabsTriggerProps,
  TabsContentProps,
} from './Tabs';

// Drawer
export {
  Drawer,
  DrawerOverlay,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerBody,
  DrawerFooter,
  DrawerClose,
} from './Drawer';
export type {
  DrawerProps,
  DrawerOverlayProps,
  DrawerContentProps,
  DrawerHeaderProps,
  DrawerTitleProps,
  DrawerDescriptionProps,
  DrawerBodyProps,
  DrawerFooterProps,
  DrawerCloseProps,
} from './Drawer';
