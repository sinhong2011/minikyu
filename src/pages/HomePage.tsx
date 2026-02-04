import {
  Book01Icon,
  CommandIcon,
  Compass01Icon,
  CubeIcon,
  KeyboardIcon,
  LayerIcon,
  SparklesIcon,
  ZapIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function HomePage() {
  const { _ } = useLingui();

  const features = [
    {
      icon: CubeIcon,
      title: _(msg`Tauri v2`),
      description: _(msg`Modern Rust-powered desktop framework`),
    },
    {
      icon: ZapIcon,
      title: _(msg`React 19`),
      description: _(msg`Latest React with concurrent features`),
    },
    {
      icon: LayerIcon,
      title: _(msg`TanStack`),
      description: _(msg`Query, Router, and Table integration`),
    },
    {
      icon: KeyboardIcon,
      title: _(msg`Shortcuts`),
      description: _(msg`Customizable keyboard shortcuts`),
    },
    {
      icon: CommandIcon,
      title: _(msg`Command Palette`),
      description: _(msg`Quick access to all features`),
    },
    {
      icon: SparklesIcon,
      title: _(msg`shadcn/ui`),
      description: _(msg`Beautiful, accessible components`),
    },
  ];

  const quickLinks = [
    {
      icon: Book01Icon,
      label: _(msg`Documentation`),
      action: () => {},
    },
    {
      icon: Compass01Icon,
      label: _(msg`Explore Features`),
      action: () => {},
    },
  ];

  return (
    <div className="flex h-full flex-col overflow-auto p-8">
      {/* Hero Section */}
      <div className="mb-8 space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">{_(msg`Welcome to Tauri Template`)}</h1>
        <p className="text-lg text-muted-foreground max-w-2xl">
          {_(
            msg`A modern, production-ready template for building cross-platform desktop applications with React, TypeScript, and Rust.`
          )}
        </p>
        <div className="flex gap-3 pt-2">
          {quickLinks.map((link) => (
            <Button key={link.label} variant="outline" className="gap-2" onClick={link.action}>
              <HugeiconsIcon icon={link.icon} className="size-4" />
              {link.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => (
          <Card key={feature.title} className="transition-colors hover:bg-muted/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <HugeiconsIcon icon={feature.icon} className="size-5 text-primary" />
                </div>
                <CardTitle className="text-base">{feature.title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>{feature.description}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Getting Started Tip */}
      <div className="mt-8 rounded-lg border bg-muted/50 p-4">
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">{_(msg`Tip:`)}</strong> {_(msg`Press`)}{' '}
          <kbd className="rounded bg-background px-1.5 py-0.5 text-xs font-mono border">Cmd</kbd> +{' '}
          <kbd className="rounded bg-background px-1.5 py-0.5 text-xs font-mono border">K</kbd>{' '}
          {_(msg`to open the command palette and explore available commands.`)}
        </p>
      </div>
    </div>
  );
}
