import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarIcon, Dice6, Eraser, Save, Sparkles, Timer as TimerIcon, Trash } from 'lucide-react';

import { ArtifactMetadata } from '@/lib/types';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'pixel-time-capsule-entries';
const DRAW_TIME = 60;

interface CapsuleEntry {
  id: string;
  date: string; // YYYY-MM-DD
  mood: string;
  imageData: string;
  createdAt: string;
}

const moodPlaceholders = [
  '오늘의 공기 한 줄로 남겨보기',
  '지금 떠오르는 기분은?',
  '짧게라도 괜찮아요 ☁️',
  '오늘을 표현하는 말 한마디',
];

const formatDate = (date: string) => {
  const [year, month, day] = date.split('-');
  return `${year}.${month}.${day}`;
};

const getToday = () => new Date().toISOString().split('T')[0];

const loadEntries = (): CapsuleEntry[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CapsuleEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to load entries', error);
    return [];
  }
};

const persistEntries = (entries: CapsuleEntry[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
};

const getPlaceholder = () =>
  moodPlaceholders[Math.floor(Math.random() * moodPlaceholders.length)];

const PixelTimeCapsule: React.FC = () => {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [timeLeft, setTimeLeft] = useState(DRAW_TIME);
  const [timerRunning, setTimerRunning] = useState(false);
  const [drawingEnabled, setDrawingEnabled] = useState(false);
  const [mood, setMood] = useState('');
  const [entries, setEntries] = useState<CapsuleEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'today' | 'timeline'>('today');
  const placeholder = useMemo(getPlaceholder, []);

  useEffect(() => {
    const initialEntries = loadEntries();
    setEntries(initialEntries);
    if (initialEntries.length) {
      setSelectedId(initialEntries[0].id);
    }
  }, []);

  useEffect(() => {
    persistEntries(entries);
  }, [entries]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      context.scale(ratio, ratio);
      context.lineCap = 'round';
      context.lineJoin = 'round';
      clearCanvas();
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!timerRunning) return;
    if (timeLeft <= 0) {
      setTimerRunning(false);
      setDrawingEnabled(false);
      toast({
        title: '⏰ 1분 완료!',
        description: '지금까지의 낙서를 저장해 보세요.',
      });
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, timerRunning, toast]);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const { width, height } = canvas;
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, width, height);
    context.restore();
    context.fillStyle = '#f8fafc';
    context.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    context.strokeStyle = '#cbd5e1';
    context.setLineDash([6, 4]);
    context.strokeRect(12, 12, canvas.clientWidth - 24, canvas.clientHeight - 24);
    context.setLineDash([]);
  }, []);

  const handleStart = () => {
    clearCanvas();
    setTimeLeft(DRAW_TIME);
    setTimerRunning(true);
    setDrawingEnabled(true);
    setMood('');
    toast({
      title: '오늘의 캡슐을 시작했어요',
      description: '1분 동안 마음껏 낙서하고 기분을 남겨보세요.',
    });
  };

  const getContext = () => {
    const canvas = canvasRef.current;
    return canvas ? canvas.getContext('2d') : null;
  };

  const pointerPosition = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingEnabled || timeLeft <= 0) return;
    const context = getContext();
    if (!context) return;
    const { x, y } = pointerPosition(event);
    drawing.current = true;
    context.beginPath();
    context.moveTo(x, y);
    context.lineWidth = 3;
    context.strokeStyle = '#1f2937';
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !drawingEnabled || timeLeft <= 0) return;
    const context = getContext();
    if (!context) return;
    const { x, y } = pointerPosition(event);
    context.lineTo(x, y);
    context.stroke();
  };

  const handlePointerUp = () => {
    if (!drawing.current) return;
    drawing.current = false;
  };

  const todayDate = getToday();

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const imageData = canvas.toDataURL('image/png');
    const existing = entries.find((entry) => entry.date === todayDate);
    if (existing) {
      const confirmOverride = window.confirm('오늘 기록이 이미 있어요. 새로 덮어쓸까요?');
      if (!confirmOverride) return;
    }

    const newEntry: CapsuleEntry = {
      id: existing?.id ?? crypto.randomUUID(),
      date: todayDate,
      mood: mood.trim() || '기분 한 줄이 비어 있어요.',
      imageData,
      createdAt: new Date().toISOString(),
    };

    const filtered = entries.filter((entry) => entry.id !== newEntry.id && entry.date !== todayDate);
    const nextEntries = [newEntry, ...filtered].sort((a, b) => b.date.localeCompare(a.date));
    setEntries(nextEntries);
    setSelectedId(newEntry.id);
    setActiveTab('timeline');
    setTimerRunning(false);
    setDrawingEnabled(false);
    toast({
      title: '오늘의 캡슐이 저장되었어요 ✨',
      description: `${formatDate(todayDate)} 기록을 타임라인에 추가했습니다.`,
    });
  };

  const selectedEntry = entries.find((entry) => entry.id === selectedId);

  const handleRandom = () => {
    if (!entries.length) return;
    const randomEntry = entries[Math.floor(Math.random() * entries.length)];
    setSelectedId(randomEntry.id);
    setActiveTab('timeline');
    toast({
      title: 'Time-slip! ✨',
      description: `${formatDate(randomEntry.date)}의 나에게 순간 이동했습니다.`,
    });
  };

  const navigateDetail = (direction: 'prev' | 'next') => {
    if (!selectedEntry) return;
    const index = entries.findIndex((entry) => entry.id === selectedEntry.id);
    const nextIndex = direction === 'prev' ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= entries.length) return;
    setSelectedId(entries[nextIndex].id);
  };

  const resetAll = () => {
    setEntries([]);
    setSelectedId(null);
    toast({ title: '모든 타임캡슐을 비웠어요.', description: '새로운 하루를 시작해 보세요.' });
  };

  const timePercent = Math.max(0, (timeLeft / DRAW_TIME) * 100);
  const saveDisabled = !canvasRef.current;

  return (
    <TooltipProvider>
      <div className="p-6 md:p-8 bg-gradient-to-b from-slate-50 to-white min-h-[720px]">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <CalendarIcon className="h-4 w-4" />
                <span>오늘의 캡슐</span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                Pixel Time Capsule
              </h1>
              <p className="text-slate-600 text-sm">
                매일 1분 낙서와 한 줄 기분을 남기고, 랜덤 타임슬립으로 과거의 나를 만나보세요.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={handleRandom} disabled={!entries.length}>
                    <Dice6 className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>랜덤 타임슬립</TooltipContent>
              </Tooltip>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Trash className="h-5 w-5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>모든 기록을 비울까요?</AlertDialogTitle>
                    <AlertDialogDescription>
                      지금까지 만든 모든 타임캡슐이 삭제됩니다. 다시 되돌릴 수 없어요.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>취소</AlertDialogCancel>
                    <AlertDialogAction onClick={resetAll}>정말 삭제</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          <Card className="border-dashed border-slate-200">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-2xl">
                    <Sparkles className="h-5 w-5 text-amber-500" /> 오늘의 기록
                  </CardTitle>
                  <CardDescription>1분 동안 낙서를 그리고 오늘의 기분을 남겨보세요.</CardDescription>
                </div>
                <Badge variant="secondary" className="font-semibold">
                  {formatDate(todayDate)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="grid gap-6 lg:grid-cols-[1.4fr,1fr]">
              <div className="space-y-4">
                <div className="relative rounded-xl border border-slate-200 bg-white shadow-inner">
                  <canvas
                    ref={canvasRef}
                    className={cn(
                      'w-full h-[340px] rounded-xl touch-none select-none',
                      drawingEnabled ? 'cursor-crosshair' : 'cursor-not-allowed',
                    )}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                  />
                  {!drawingEnabled && !timerRunning && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-500">
                      <Eraser className="h-6 w-6" />
                      <p className="text-sm">시작을 눌러 오늘의 첫 낙서를 남겨보세요.</p>
                    </div>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="mood">오늘 기분 한 줄</Label>
                    <Input
                      id="mood"
                      value={mood}
                      onChange={(event) => setMood(event.target.value)}
                      placeholder={placeholder}
                      maxLength={80}
                    />
                  </div>
                  <div className="flex flex-col justify-end gap-2">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <TimerIcon className="h-4 w-4" />
                      <span>{timeLeft.toString().padStart(2, '0')}s</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-sky-400 transition-all"
                        style={{ width: `${timePercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm text-slate-600">
                    60초 동안 자유롭게 낙서하고 오늘의 기분을 한 문장으로 남겨보세요. 저장 시 이 브라우저에만 안전하게
                    보관됩니다.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Button variant="secondary" onClick={handleStart}>
                    {timerRunning || drawingEnabled ? '다시 그리기' : '시작'}
                  </Button>
                  <Button onClick={handleSave} disabled={saveDisabled}>
                    <Save className="mr-2 h-4 w-4" /> 저장
                  </Button>
                </div>
                <div className="text-xs text-slate-500 space-y-1">
                  <p>· 저장 시 동일 날짜 기록이 있으면 덮어쓸 수 있어요.</p>
                  <p>· 기록은 이 브라우저에만 저장되며, 서버로 전송되지 않습니다.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'today' | 'timeline')}>
            <TabsList>
              <TabsTrigger value="today">오늘 기록</TabsTrigger>
              <TabsTrigger value="timeline">타임라인</TabsTrigger>
            </TabsList>

            <TabsContent value="timeline" className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <h2 className="text-xl font-semibold text-slate-900">타임라인</h2>
                  <p className="text-sm text-slate-600">날짜별로 쌓인 낙서와 기분을 카드로 둘러보세요.</p>
                </div>
                <div className="text-sm text-slate-500">총 {entries.length}개 기록</div>
              </div>
              <div className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
                <ScrollArea className="h-[420px] rounded-xl border border-slate-200 bg-white p-4">
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {entries.length === 0 && (
                      <div className="col-span-full flex flex-col items-center gap-2 py-12 text-slate-500">
                        <Sparkles className="h-5 w-5" />
                        <p className="text-sm">아직 저장된 타임캡슐이 없어요. 오늘을 기록해 보세요.</p>
                      </div>
                    )}
                    {entries.map((entry) => (
                      <Card
                        key={entry.id}
                        className={cn(
                          'transition hover:shadow-md cursor-pointer border-2',
                          selectedId === entry.id ? 'border-indigo-500' : 'border-slate-200',
                        )}
                        onClick={() => setSelectedId(entry.id)}
                      >
                        <CardHeader className="space-y-1">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base">{formatDate(entry.date)}</CardTitle>
                            <Badge variant="outline" className="text-[11px]">
                              {new Date(entry.createdAt).toLocaleDateString()}
                            </Badge>
                          </div>
                          <CardDescription className="line-clamp-2 text-sm text-slate-600">
                            {entry.mood}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="overflow-hidden rounded-lg border border-slate-200">
                            <img src={entry.imageData} alt={`${entry.date} 낙서`} className="h-32 w-full object-cover" />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>

                <Card className="self-start">
                  <CardHeader>
                    <CardTitle className="text-lg">상세 보기</CardTitle>
                    <CardDescription>
                      카드를 클릭하면 낙서와 한 줄 기분을 크게 볼 수 있어요. 랜덤 타임슬립으로 추억을 열어보세요.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {!selectedEntry && (
                      <div className="flex flex-col items-center gap-3 py-10 text-slate-500">
                        <CalendarIcon className="h-5 w-5" />
                        <p className="text-sm">아직 선택된 기록이 없어요.</p>
                      </div>
                    )}
                    {selectedEntry && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-slate-500">{formatDate(selectedEntry.date)}</p>
                            <p className="text-lg font-semibold text-slate-900">{selectedEntry.mood}</p>
                          </div>
                          <Badge variant="secondary">타임슬립 중</Badge>
                        </div>
                        <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                          <img
                            src={selectedEntry.imageData}
                            alt={`${selectedEntry.date} 낙서 전체 보기`}
                            className="w-full"
                          />
                        </div>
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="flex justify-between">
                    <Button variant="outline" onClick={() => navigateDetail('prev')} disabled={!selectedEntry}>
                      이전
                    </Button>
                    <Button variant="outline" onClick={() => navigateDetail('next')} disabled={!selectedEntry}>
                      다음
                    </Button>
                  </CardFooter>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="today">
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                위에서 저장한 오늘의 기록을 타임라인 탭에서 확인할 수 있어요. 저장 후 바로 타임라인으로 이동합니다.
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </TooltipProvider>
  );
};

export const metadata: ArtifactMetadata = {
  title: 'Pixel Time Capsule',
  description: '매일 1분 낙서와 한 줄 기분을 남기는 미니 타임캡슐 웹앱',
  type: 'react',
  tags: ['daily', 'canvas', 'timeline', 'interactive'],
  folder: 'Concepts',
  createdAt: '2024-08-01T00:00:00Z',
  updatedAt: '2024-08-01T00:00:00Z',
};

export default PixelTimeCapsule;
