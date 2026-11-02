import { useEffect, useRef, useState } from 'react';
import { Circle, Crosshair, Square } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { cn } from '../lib/utils';

const VIEWPORT_SIZE = 300;
const OUTPUT_SIZE = 512;

type CropShape = 'square' | 'circle';

interface Offset {
  x: number;
  y: number;
}

interface AvatarCropperProps {
  file: File;
  busy?: boolean;
  error?: string;
  onCancel: () => void;
  onConfirm: (blob: Blob) => Promise<void> | void;
}

function clampOffset(offset: Offset, scale: number, image: HTMLImageElement): Offset {
  const maxX = Math.max(0, (image.naturalWidth * scale - VIEWPORT_SIZE) / 2);
  const maxY = Math.max(0, (image.naturalHeight * scale - VIEWPORT_SIZE) / 2);
  return {
    x: Math.min(maxX, Math.max(-maxX, offset.x)),
    y: Math.min(maxY, Math.max(-maxY, offset.y)),
  };
}

export function AvatarCropper({ file, busy = false, error = '', onCancel, onConfirm }: AvatarCropperProps) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [shape, setShape] = useState<CropShape>('circle');
  const [loadError, setLoadError] = useState('');
  const [exporting, setExporting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let reader: FileReader | null = null;
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    const fail = () => {
      if (!cancelled) setLoadError('无法读取图片，请换一张再试。');
    };

    // 某些部署的 CSP 会拦截 blob:，此时改用 data: 再读取一次。
    const loadAsDataUrl = () => {
      if (cancelled) return;
      reader = new FileReader();
      reader.onload = () => {
        const result = reader?.result;
        if (cancelled || typeof result !== 'string') return;
        img.src = result;
      };
      reader.onerror = fail;
      reader.readAsDataURL(file);
    };

    img.onload = () => {
      if (cancelled) return;
      setImage(img);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setLoadError('');
    };
    img.onerror = () => {
      if (cancelled) return;
      if (img.src.startsWith('blob:')) {
        loadAsDataUrl();
      } else {
        fail();
      }
    };
    img.src = objectUrl;

    return () => {
      cancelled = true;
      URL.revokeObjectURL(objectUrl);
      reader?.abort();
    };
  }, [file]);

  const baseScale = image
    ? Math.max(VIEWPORT_SIZE / image.naturalWidth, VIEWPORT_SIZE / image.naturalHeight)
    : 1;
  const scale = baseScale * zoom;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pixelSize = Math.round(VIEWPORT_SIZE * dpr);
    if (canvas.width !== pixelSize) {
      canvas.width = pixelSize;
      canvas.height = pixelSize;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, VIEWPORT_SIZE, VIEWPORT_SIZE);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, VIEWPORT_SIZE, VIEWPORT_SIZE);

    if (image) {
      const width = image.naturalWidth * scale;
      const height = image.naturalHeight * scale;
      ctx.drawImage(
        image,
        VIEWPORT_SIZE / 2 + offset.x - width / 2,
        VIEWPORT_SIZE / 2 + offset.y - height / 2,
        width,
        height,
      );
    }

    if (shape === 'circle') {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, VIEWPORT_SIZE, VIEWPORT_SIZE);
      ctx.arc(VIEWPORT_SIZE / 2, VIEWPORT_SIZE / 2, VIEWPORT_SIZE / 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(2, 6, 23, 0.62)';
      ctx.fill('evenodd');
      ctx.restore();
    }

    ctx.save();
    ctx.beginPath();
    if (shape === 'circle') {
      ctx.arc(VIEWPORT_SIZE / 2, VIEWPORT_SIZE / 2, VIEWPORT_SIZE / 2 - 1, 0, Math.PI * 2);
      ctx.clip();
    } else {
      ctx.rect(1, 1, VIEWPORT_SIZE - 2, VIEWPORT_SIZE - 2);
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 2; i += 1) {
      const position = (VIEWPORT_SIZE / 3) * i;
      ctx.beginPath();
      ctx.moveTo(position, 0);
      ctx.lineTo(position, VIEWPORT_SIZE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, position);
      ctx.lineTo(VIEWPORT_SIZE, position);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (shape === 'circle') {
      ctx.arc(VIEWPORT_SIZE / 2, VIEWPORT_SIZE / 2, VIEWPORT_SIZE / 2 - 1, 0, Math.PI * 2);
    } else {
      ctx.rect(1, 1, VIEWPORT_SIZE - 2, VIEWPORT_SIZE - 2);
    }
    ctx.stroke();
    ctx.restore();
  }, [image, offset, scale, shape]);

  const changeZoom = (nextZoom: number) => {
    setZoom(nextZoom);
    if (image) {
      setOffset((previous) => clampOffset(previous, baseScale * nextZoom, image));
    }
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!image) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !image) return;

    // 小屏上画布会被 max-w-full 缩小，指针位移需换算回画布坐标系。
    const rect = event.currentTarget.getBoundingClientRect();
    const factor = rect.width > 0 ? VIEWPORT_SIZE / rect.width : 1;

    setOffset(clampOffset({
      x: drag.originX + (event.clientX - drag.startX) * factor,
      y: drag.originY + (event.clientY - drag.startY) * factor,
    }, scale, image));
  };

  const endDrag = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleConfirm = () => {
    if (!image || exporting || busy) return;

    const output = document.createElement('canvas');
    output.width = OUTPUT_SIZE;
    output.height = OUTPUT_SIZE;
    const ctx = output.getContext('2d');
    if (!ctx) {
      setLoadError('当前浏览器无法处理图片，请更换浏览器。');
      return;
    }

    const ratio = OUTPUT_SIZE / VIEWPORT_SIZE;
    const outputScale = scale * ratio;
    const width = image.naturalWidth * outputScale;
    const height = image.naturalHeight * outputScale;

    ctx.drawImage(
      image,
      OUTPUT_SIZE / 2 + offset.x * ratio - width / 2,
      OUTPUT_SIZE / 2 + offset.y * ratio - height / 2,
      width,
      height,
    );

    if (shape === 'circle') {
      ctx.globalCompositeOperation = 'destination-in';
      ctx.beginPath();
      ctx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    setExporting(true);
    output.toBlob((blob) => {
      if (!blob) {
        setExporting(false);
        setLoadError('生成头像失败，请重试。');
        return;
      }
      Promise.resolve(onConfirm(blob))
        .catch(() => {
          // 上传失败由设置页展示具体错误。
        })
        .finally(() => setExporting(false));
    }, 'image/png');
  };

  const pending = exporting || busy;

  return (
    <Modal
      isOpen
      title="裁剪头像"
      size="lg"
      onClose={pending ? () => {} : onCancel}
      closeOnOverlayClick={false}
      footer={(
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
            取消
          </Button>
          <Button type="button" onClick={handleConfirm} loading={pending} disabled={!image || Boolean(loadError)}>
            使用此头像
          </Button>
        </div>
      )}
    >
      <div className="space-y-4">
        <p className="text-sm text-secondary-500 dark:text-secondary-400">
          拖动图片调整位置，使用滑块缩放。头像会按所选形状居中裁剪。
        </p>

        <div className="flex justify-center">
          <div className="rounded-2xl overflow-hidden bg-secondary-950 shadow-inner">
            <canvas
              ref={canvasRef}
              style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE }}
              className={cn(
                'block max-w-full touch-none select-none',
                image ? 'cursor-grab active:cursor-grabbing' : 'cursor-default',
              )}
              aria-label="头像裁剪区域，拖动可调整位置"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onDragStart={(event) => event.preventDefault()}
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-secondary-600 dark:text-secondary-300">形状</span>
            <div className="inline-flex rounded-lg border border-secondary-200 dark:border-secondary-700 p-0.5">
              <button
                type="button"
                onClick={() => setShape('square')}
                aria-pressed={shape === 'square'}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors',
                  shape === 'square'
                    ? 'bg-amber-500 text-white'
                    : 'text-secondary-600 dark:text-secondary-300 hover:bg-secondary-100 dark:hover:bg-secondary-800',
                )}
              >
                <Square className="h-3.5 w-3.5" />
                方形
              </button>
              <button
                type="button"
                onClick={() => setShape('circle')}
                aria-pressed={shape === 'circle'}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors',
                  shape === 'circle'
                    ? 'bg-amber-500 text-white'
                    : 'text-secondary-600 dark:text-secondary-300 hover:bg-secondary-100 dark:hover:bg-secondary-800',
                )}
              >
                <Circle className="h-3.5 w-3.5" />
                圆形
              </button>
            </div>
          </div>

          <div className="flex flex-1 items-center gap-3">
            <label htmlFor="avatar-zoom" className="text-sm text-secondary-600 dark:text-secondary-300 whitespace-nowrap">
              缩放
            </label>
            <input
              id="avatar-zoom"
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(event) => changeZoom(Number(event.target.value))}
              className="flex-1 accent-amber-500"
            />
            <button
              type="button"
              onClick={() => setOffset({ x: 0, y: 0 })}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-secondary-500 hover:text-secondary-800 dark:text-secondary-400 dark:hover:text-secondary-100"
            >
              <Crosshair className="h-3.5 w-3.5" />
              居中
            </button>
          </div>
        </div>

        {!image && !loadError && (
          <p className="text-sm text-secondary-500 dark:text-secondary-400">正在读取图片…</p>
        )}
        {(loadError || error || !file) && (
          <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
            {loadError || error || '没有可裁剪的图片。'}
          </p>
        )}
      </div>
    </Modal>
  );
}
