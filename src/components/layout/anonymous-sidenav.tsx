import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Home, MessageSquare, Bell, Bookmark, Star, User as UserIcon, Settings, LogOut,
  PlusCircle, DollarSign, HelpCircle, Sun, Moon, CreditCard, UserPlus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from 'sonner';

interface NavItem {
  href: string;
  icon: React.ElementType;
  label: string;
}

export function AnonymousSideNav() {
  const pathname = usePathname();
  const { theme, setTheme, resolvedTheme } = useTheme();

  const toggleTheme = () => {
    const newTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    toast.success(`Switched to ${newTheme} mode`);
  };

  const isDarkMode = resolvedTheme === "dark";

  // Simplified nav items for anonymous users
  const navItems: NavItem[] = [
    { href: "/home", icon: Home, label: "Home" },
    { href: "/messages", icon: MessageSquare, label: "Messages" },
    { href: "/notifications", icon: Bell, label: "Notifications" },
    { href: "/bookmarks", icon: Bookmark, label: "Bookmarks" },
    { href: "/subscriptions", icon: Star, label: "Subscriptions" },
  ];

  return (
    <aside className="hidden md:flex md:flex-col md:w-64 border-r bg-background p-4 space-y-6 fixed h-screen">
      {/* Top section: Anonymous Profile Info */}
      <div className="flex justify-between items-start mb-2">
        <div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="flex flex-col items-start space-y-0.5 cursor-pointer group">
                <div className="w-8 h-8 mb-2 rounded-full bg-muted flex items-center justify-center text-md font-semibold group-hover:ring-2 group-hover:ring-pink-500 transition-all overflow-hidden">
                  <UserIcon className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-48" align="start" sideOffset={-20} alignOffset={16}>
              <DropdownMenuLabel>Account Options</DropdownMenuLabel>
              <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                  <Link href="/login">
                    <UserIcon className="mr-2 h-4 w-4" />
                    <span>Sign In</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/signup">
                    <UserPlus className="mr-2 h-4 w-4" />
                    <span>Sign Up</span>
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Platform</DropdownMenuLabel>
              <DropdownMenuGroup>
                <DropdownMenuItem>
                  <HelpCircle className="mr-2 h-4 w-4" />
                  <span>Help Center</span>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="p-0 focus:bg-transparent">
                  <div className="flex items-center justify-center w-full px-2 py-1.5">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isDarkMode}
                      onClick={toggleTheme}
                      className={cn(
                        "relative inline-flex items-center h-9 w-[88px] shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out",
                        "bg-gray-200 dark:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      )}
                    >
                      <span className="sr-only">Toggle theme</span>
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 z-0">
                        <Sun size={18} className={cn("text-gray-400 dark:text-gray-500", !isDarkMode ? "opacity-0" : "opacity-100")} />
                      </span>
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 z-0">
                        <Moon size={18} className={cn("text-gray-400 dark:text-gray-500", isDarkMode ? "opacity-0" : "opacity-100")} />
                      </span>
                      <span
                        aria-hidden="true"
                        className={cn(
                          "pointer-events-none absolute inline-block h-[28px] w-[42px] transform rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ease-in-out",
                          isDarkMode ? "translate-x-[40px]" : "translate-x-[2px]"
                        )}
                      >
                        {isDarkMode ? 
                          <div className="flex items-center justify-center w-full h-full">
                            <Moon size={16} className="text-gray-700" />
                          </div> : 
                          <div className="flex items-center justify-center w-full h-full">
                            <Sun size={16} className="text-orange-500" />
                          </div>
                        }
                      </span>
                    </button>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <p className="font-semibold text-sm text-neutral-900 dark:text-neutral-50">Anonymous User</p>
          <p className="text-xs text-muted-foreground">@anonymous</p>
        </div>
        <Button className="bg-pink-500 hover:bg-pink-600 text-white text-xs px-3 py-1.5 h-auto shrink-0">
          0 CREDITS
        </Button>
      </div>
      
      {/* Navigation Links */}
      <nav className="flex-grow mt-10">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.label}>
              <Link 
                href={item.href} 
                className={cn(
                  "flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-muted",
                  pathname === item.href ? "bg-muted text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="relative mr-3 h-5 w-5 flex items-center justify-center">
                  <item.icon className="h-5 w-5" />
                </span>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Sign Up Button */}
      <div className="mt-auto">
        <Button className="w-full bg-pink-500 hover:bg-pink-600 text-white" asChild>
          <Link href="/signup">
            <UserPlus className="mr-2 h-4 w-4" /> SIGN UP
          </Link>
        </Button>
      </div>
    </aside>
  );
} 