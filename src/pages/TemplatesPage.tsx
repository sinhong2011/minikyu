import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import {
  ArrowRight,
  Boxes,
  Copy,
  ExternalLink,
  FileCode,
  FolderOpen,
  Github,
  Layout,
  Sparkles,
  Terminal,
} from 'lucide-react';
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

export function TemplatesPage() {
  const { _ } = useLingui();

  const templates = [
    {
      id: 'starter',
      name: _(msg`Starter Template`),
      description: _(msg`Minimal setup with essential features. Perfect for new projects.`),
      icon: Layout,
      tags: ['Minimal', 'Essential'],
      features: [
        _(msg`React 19 + TypeScript`),
        _(msg`Tauri v2`),
        _(msg`Tailwind CSS`),
        _(msg`shadcn/ui`),
      ],
    },
    {
      id: 'full',
      name: _(msg`Full-Featured Template`),
      description: _(msg`Complete setup with all features enabled. Best for production apps.`),
      icon: Boxes,
      tags: ['Complete', 'Production'],
      features: [
        _(msg`TanStack Query + Router`),
        _(msg`i18n (Lingui)`),
        _(msg`Command Palette`),
        _(msg`Theme Support`),
      ],
    },
    {
      id: 'plugin',
      name: _(msg`Plugin Template`),
      description: _(msg`Template for building Tauri plugins with example implementations.`),
      icon: FileCode,
      tags: ['Plugin', 'Rust'],
      features: [
        _(msg`Plugin Architecture`),
        _(msg`Rust Commands`),
        _(msg`TypeScript Bindings`),
        _(msg`Examples`),
      ],
    },
  ];

  const quickStartSteps = [
    {
      step: '1',
      title: _(msg`Clone the Repository`),
      command: 'git clone https://github.com/your-org/tauri-template.git',
    },
    {
      step: '2',
      title: _(msg`Install Dependencies`),
      command: 'bun install',
    },
    {
      step: '3',
      title: _(msg`Run Development Server`),
      command: 'bun run tauri dev',
    },
  ];

  return (
    <div className="flex h-full flex-col overflow-auto p-8">
      {/* Header */}
      <div className="mb-8 space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">{_(msg`Project Templates`)}</h1>
        <p className="text-lg text-muted-foreground max-w-2xl">
          {_(
            msg`Choose a template to kickstart your Tauri application. Each template is optimized for different use cases and includes pre-configured tools and patterns.`
          )}
        </p>
      </div>

      {/* Templates Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
        {templates.map((template) => (
          <Card
            key={template.id}
            className="flex flex-col transition-colors hover:border-primary/50"
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <template.icon className="size-6 text-primary" />
                </div>
                <div className="flex gap-1">
                  {template.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
              <CardTitle className="mt-4">{template.name}</CardTitle>
              <CardDescription>{template.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <ul className="space-y-2">
                {template.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                  >
                    <Sparkles className="size-3.5 text-primary" />
                    {feature}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter className="gap-2">
              <Button className="flex-1 gap-2">
                <Copy className="size-4" />
                {_(msg`Use Template`)}
              </Button>
              <Button variant="outline" size="icon">
                <ExternalLink className="size-4" />
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* Quick Start Section */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
              <Terminal className="size-5 text-green-600" />
            </div>
            <div>
              <CardTitle>{_(msg`Quick Start`)}</CardTitle>
              <CardDescription>
                {_(msg`Get started with the template in three simple steps.`)}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {quickStartSteps.map((item) => (
              <div key={item.step} className="flex items-start gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-sm font-medium">
                  {item.step}
                </div>
                <div className="flex-1 space-y-2">
                  <p className="font-medium">{item.title}</p>
                  <code className="block rounded bg-muted px-3 py-2 font-mono text-sm">
                    {item.command}
                  </code>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
        <CardFooter className="flex gap-2 border-t bg-muted/50 px-6 py-4">
          <Button variant="outline" className="gap-2">
            <Github className="size-4" />
            {_(msg`View on GitHub`)}
          </Button>
          <Button variant="outline" className="gap-2">
            <FolderOpen className="size-4" />
            {_(msg`Documentation`)}
          </Button>
        </CardFooter>
      </Card>

      {/* Resources */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="transition-colors hover:bg-muted/50">
          <CardHeader>
            <CardTitle className="text-base">{_(msg`Documentation`)}</CardTitle>
            <CardDescription>
              {_(msg`Learn more about the template architecture and patterns.`)}
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button variant="ghost" className="gap-2 px-0 hover:bg-transparent">
              {_(msg`Read Docs`)}
              <ArrowRight className="size-4" />
            </Button>
          </CardFooter>
        </Card>
        <Card className="transition-colors hover:bg-muted/50">
          <CardHeader>
            <CardTitle className="text-base">{_(msg`Community`)}</CardTitle>
            <CardDescription>
              {_(msg`Join the community to get help and share your projects.`)}
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button variant="ghost" className="gap-2 px-0 hover:bg-transparent">
              {_(msg`Join Discord`)}
              <ArrowRight className="size-4" />
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
