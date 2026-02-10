import { Plus, Trash2 } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Badge, Button, Card, Input, Textarea } from './index';

export function ExampleUsage() {
  return (
    <div className="p-6 space-y-10">
      <header className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-bold">UI Components</div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            Example usage of Button, Card, Input, Textarea, Badge
          </div>
        </div>
        <ThemeToggle />
      </header>

      <section className="space-y-4">
        <div className="text-lg font-semibold">Buttons</div>
        <div className="flex flex-wrap gap-3">
          <Button variant="primary" icon={<Plus size={18} />}>
            Primary
          </Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="danger" icon={<Trash2 size={18} />}>
            Danger
          </Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="primary" loading>
            Loading
          </Button>
        </div>
      </section>

      <section className="space-y-4">
        <div className="text-lg font-semibold">Cards</div>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <div className="text-sm text-slate-500 dark:text-slate-400">Default card</div>
            <div className="mt-2 font-semibold">Card content</div>
          </Card>
          <Card gradient="from-indigo-500/20 to-rose-500/20">
            <div className="text-sm text-slate-500 dark:text-slate-400">Gradient card</div>
            <div className="mt-2 font-semibold">Card content</div>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <div className="text-lg font-semibold">Inputs</div>
        <div className="grid gap-6 md:grid-cols-2">
          <Input label="Name" placeholder="Type your name..." />
          <Input label="Email" placeholder="name@example.com" error="Invalid email" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Textarea label="Message" placeholder="Type your message..." />
          <Textarea label="Notes" placeholder="Some notes..." error="This field is required" />
        </div>
      </section>

      <section className="space-y-4">
        <div className="text-lg font-semibold">Badges</div>
        <div className="flex flex-wrap gap-3">
          <Badge variant="success">Success</Badge>
          <Badge variant="error">Error</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="info">Info</Badge>
          <Badge variant="info" size="sm">
            Small
          </Badge>
        </div>
      </section>
    </div>
  );
}

