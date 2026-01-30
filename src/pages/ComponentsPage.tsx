import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Layers,
  Mail,
  MoreHorizontal,
  Settings,
  User,
} from 'lucide-react';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/animate-ui/components/animate/tabs';
import { Switch } from '@/components/animate-ui/components/radix/switch';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/animate-ui/primitives/radix/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/animate-ui/primitives/radix/dropdown-menu';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

export function ComponentsPage() {
  const { _ } = useLingui();

  return (
    <div className="flex h-full flex-col overflow-auto p-8">
      <div className="mb-8 space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{_(msg`Component Showcase`)}</h1>
        <p className="text-muted-foreground">
          {_(msg`Explore the UI components available in this template.`)}
        </p>
      </div>

      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{_(msg`Total Revenue`)}</CardDescription>
              <CardTitle className="text-3xl">$45,231.89</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">+20.1% {_(msg`from last month`)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{_(msg`Active Users`)}</CardDescription>
              <CardTitle className="text-3xl">+2,350</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">+180.1% {_(msg`from last month`)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{_(msg`Sales`)}</CardDescription>
              <CardTitle className="text-3xl">+12,234</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">+19% {_(msg`from last month`)}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>{_(msg`Recent Activity`)}</CardTitle>
              <CardDescription>{_(msg`You have 3 unread messages.`)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                {
                  name: 'Olivia Martin',
                  email: 'olivia.martin@email.com',
                  amount: '+$1,999.00',
                },
                {
                  name: 'Jackson Lee',
                  email: 'jackson.lee@email.com',
                  amount: '+$39.00',
                },
                {
                  name: 'Isabella Nguyen',
                  email: 'isabella.nguyen@email.com',
                  amount: '+$299.00',
                },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={`/avatars/0${i + 1}.png`} alt={item.name} />
                    <AvatarFallback>
                      {item.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-none">{item.name}</p>
                    <p className="text-sm text-muted-foreground">{item.email}</p>
                  </div>
                  <div className="font-medium">{item.amount}</div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Profile Settings */}
          <Card>
            <CardHeader>
              <CardTitle>{_(msg`Profile Settings`)}</CardTitle>
              <CardDescription>
                {_(msg`Manage your profile information and preferences.`)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">{_(msg`Display Name`)}</Label>
                  <Input id="name" placeholder="Enter your name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">{_(msg`Email`)}</Label>
                  <Input id="email" type="email" placeholder="Enter your email" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bio">{_(msg`Bio`)}</Label>
                <Input id="bio" placeholder="Tell us about yourself" />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{_(msg`Email Notifications`)}</Label>
                  <p className="text-sm text-muted-foreground">
                    {_(msg`Receive emails about your account activity.`)}
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{_(msg`Marketing Emails`)}</Label>
                  <p className="text-sm text-muted-foreground">
                    {_(msg`Receive emails about new products and features.`)}
                  </p>
                </div>
                <Switch />
              </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
              <Button variant="outline">{_(msg`Cancel`)}</Button>
              <Button>{_(msg`Save Changes`)}</Button>
            </CardFooter>
          </Card>
        </div>

        {/* Alerts & Badges */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{_(msg`Alert Examples`)}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Mail className="h-4 w-4" />
                <AlertTitle>{_(msg`Heads up!`)}</AlertTitle>
                <AlertDescription>
                  {_(msg`You can add components to your app using the shadcn CLI.`)}
                </AlertDescription>
              </Alert>

              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{_(msg`Error`)}</AlertTitle>
                <AlertDescription>
                  {_(msg`Your session has expired. Please log in again.`)}
                </AlertDescription>
              </Alert>

              <Alert className="border-green-500 text-green-700 [&>svg]:text-green-700">
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>{_(msg`Success`)}</AlertTitle>
                <AlertDescription>
                  {_(msg`Your changes have been saved successfully.`)}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{_(msg`Badges & Labels`)}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Badge>{_(msg`Default`)}</Badge>
              <Badge variant="secondary">{_(msg`Secondary`)}</Badge>
              <Badge variant="outline">{_(msg`Outline`)}</Badge>
              <Badge variant="destructive">{_(msg`Destructive`)}</Badge>
              <Badge className="bg-green-500 hover:bg-green-600">{_(msg`Success`)}</Badge>
              <Badge className="bg-blue-500 hover:bg-blue-600">{_(msg`Info`)}</Badge>
            </CardContent>
          </Card>
        </div>

        {/* Animated Tabs Showcase */}
        <Card>
          <CardHeader>
            <CardTitle>{_(msg`Animated Tabs`)}</CardTitle>
            <CardDescription>
              {_(msg`Smooth animated tabs from animate-ui with highlight effect.`)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="account" className="w-full">
              <div className="relative">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="account">
                    <User className="mr-2 size-4" />
                    {_(msg`Account`)}
                  </TabsTrigger>
                  <TabsTrigger value="settings">
                    <Settings className="mr-2 size-4" />
                    {_(msg`Settings`)}
                  </TabsTrigger>
                  <TabsTrigger value="advanced">
                    <Layers className="mr-2 size-4" />
                    {_(msg`Advanced`)}
                  </TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="account" className="mt-4 space-y-4">
                <div className="rounded-lg border p-4">
                  <h4 className="mb-2 font-medium">{_(msg`Account Information`)}</h4>
                  <p className="text-sm text-muted-foreground">
                    {_(
                      msg`Manage your account details and preferences here. The animated tabs provide a smooth visual transition between sections.`
                    )}
                  </p>
                </div>
              </TabsContent>
              <TabsContent value="settings" className="mt-4 space-y-4">
                <div className="rounded-lg border p-4">
                  <h4 className="mb-2 font-medium">{_(msg`Settings Panel`)}</h4>
                  <p className="text-sm text-muted-foreground">
                    {_(
                      msg`Configure application settings and customize your experience. The highlight effect follows the active tab smoothly.`
                    )}
                  </p>
                </div>
              </TabsContent>
              <TabsContent value="advanced" className="mt-4 space-y-4">
                <div className="rounded-lg border p-4">
                  <h4 className="mb-2 font-medium">{_(msg`Advanced Options`)}</h4>
                  <p className="text-sm text-muted-foreground">
                    {_(
                      msg`Access advanced configuration options and developer tools. Built with Radix UI primitives for accessibility.`
                    )}
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Animated Dropdown & Collapsible Showcase */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Animated Dropdown Menu */}
          <Card>
            <CardHeader>
              <CardTitle>{_(msg`Animated Dropdown`)}</CardTitle>
              <CardDescription>
                {_(msg`Dropdown menu with smooth animations and highlight effects.`)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    {_(msg`Open Menu`)}
                    <ChevronDown className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                  <DropdownMenuItem>
                    <User className="mr-2 size-4" />
                    {_(msg`Profile`)}
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Settings className="mr-2 size-4" />
                    {_(msg`Settings`)}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <MoreHorizontal className="mr-2 size-4" />
                    {_(msg`More Options`)}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardContent>
          </Card>

          {/* Animated Collapsible */}
          <Card>
            <CardHeader>
              <CardTitle>{_(msg`Animated Collapsible`)}</CardTitle>
              <CardDescription>
                {_(msg`Smooth expand/collapse animation with AnimatePresence.`)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Collapsible className="w-full">
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    {_(msg`Toggle Content`)}
                    <ChevronDown className="size-4 transition-transform duration-300 group-data-[state=open]/collapsible:rotate-180" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-4 rounded-lg border bg-muted/50 p-4">
                    <h4 className="mb-2 font-medium">{_(msg`Hidden Content`)}</h4>
                    <p className="text-sm text-muted-foreground">
                      {_(
                        msg`This content smoothly animates in and out when toggled. The collapsible uses Framer Motion's AnimatePresence for smooth enter/exit animations.`
                      )}
                    </p>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
