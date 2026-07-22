'use client';

import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';

import { cn } from '@/lib/utils';

type TabsVariant = 'default' | 'line';

const TabsListContext = React.createContext<TabsVariant>('default');

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn('flex flex-col gap-2', className)}
      {...props}
    />
  );
}

function TabsList({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & { variant?: TabsVariant }) {
  return (
    <TabsListContext.Provider value={variant}>
      <TabsPrimitive.List
        data-slot="tabs-list"
        data-variant={variant}
        className={cn(
          variant === 'line'
            ? 'inline-flex h-9 w-full items-center justify-start gap-4 border-b text-muted-foreground'
            : 'inline-flex h-9 w-fit items-center justify-center rounded-lg bg-muted p-[3px] text-muted-foreground',
          className,
        )}
        {...props}
      />
    </TabsListContext.Provider>
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const variant = React.useContext(TabsListContext);
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        variant === 'line'
          ? "relative -mb-px inline-flex h-full items-center justify-center gap-1.5 border-b-2 border-transparent px-1 py-1 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 data-[state=active]:border-foreground data-[state=active]:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          : "inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap text-foreground transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm dark:text-muted-foreground dark:data-[state=active]:bg-input/30 dark:data-[state=active]:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn('flex-1 outline-none', className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
