import { useCallback, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import { Upload, Trash2, Image as ImageIcon, Video, Loader2, X } from 'lucide-react';
import { listMedia, uploadMedia, deleteMedia } from '../api/media';
import type { MediaAsset } from '../types';
import { format } from 'date-fns';

export default function MediaLibrary() {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState<string | undefined>();
  const [selected, setSelected] = useState<MediaAsset | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['media', filter],
    queryFn: () => listMedia(filter),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteMedia,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
      setSelected(null);
    },
  });

  const onDrop = useCallback(
    async (files: File[]) => {
      setUploading(true);
      for (const file of files) {
        try {
          await uploadMedia(file);
        } catch (err) {
          console.error('Upload failed:', err);
        }
      }
      queryClient.invalidateQueries({ queryKey: ['media'] });
      setUploading(false);
    },
    [queryClient],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
      'video/*': ['.mp4', '.mov', '.avi', '.webm'],
    },
  });

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Media Library</h1>
          <p className="text-gray-500 mt-1">{data?.total ?? 0} assets</p>
        </div>
        <div className="flex gap-2">
          {['all', 'image', 'video'].map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type === 'all' ? undefined : type)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                (type === 'all' && !filter) || filter === type
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Upload area */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors mb-8 ${
          isDragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <Loader2 size={40} className="mx-auto text-blue-500 animate-spin" />
        ) : (
          <>
            <Upload size={40} className="mx-auto text-gray-400 mb-3" />
            <p className="text-gray-600 font-medium">
              Drag & drop files here, or click to browse
            </p>
            <p className="text-sm text-gray-400 mt-1">
              Images (JPG, PNG, GIF, WebP) and Videos (MP4, MOV)
            </p>
          </>
        )}
      </div>

      {/* Media grid */}
      {isLoading ? (
        <div className="text-center py-12">
          <Loader2 size={32} className="mx-auto text-blue-500 animate-spin" />
        </div>
      ) : data?.items.length ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {data.items.map((asset: MediaAsset) => (
            <div
              key={asset.id}
              onClick={() => setSelected(asset)}
              className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-colors ${
                selected?.id === asset.id ? 'border-blue-500' : 'border-transparent hover:border-gray-300'
              }`}
            >
              <div className="aspect-square bg-gray-100 flex items-center justify-center">
                {asset.media_type === 'image' && asset.thumbnail_path ? (
                  <img
                    src={`/uploads/thumbnails/${asset.thumbnail_path.split('/').pop()}`}
                    alt={asset.file_name}
                    className="w-full h-full object-cover"
                  />
                ) : asset.media_type === 'video' ? (
                  <Video size={32} className="text-gray-400" />
                ) : (
                  <ImageIcon size={32} className="text-gray-400" />
                )}
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-white text-xs truncate">{asset.file_name}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <ImageIcon size={48} className="mx-auto mb-3 text-gray-300" />
          <p>No media uploaded yet</p>
        </div>
      )}

      {/* Detail panel */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-end" onClick={() => setSelected(null)}>
          <div
            className="w-96 bg-white h-full overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-gray-900">Media Details</h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="aspect-video bg-gray-100 rounded-lg mb-4 flex items-center justify-center overflow-hidden">
              {selected.media_type === 'image' ? (
                <img
                  src={`/uploads/images/${selected.file_path.split('/').pop()}`}
                  alt={selected.file_name}
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <Video size={48} className="text-gray-400" />
              )}
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <span className="text-gray-500">Name:</span>
                <p className="font-medium text-gray-900">{selected.file_name}</p>
              </div>
              <div>
                <span className="text-gray-500">Type:</span>
                <p className="font-medium text-gray-900">{selected.mime_type}</p>
              </div>
              <div>
                <span className="text-gray-500">Size:</span>
                <p className="font-medium text-gray-900">{formatSize(selected.file_size)}</p>
              </div>
              {selected.width && selected.height && (
                <div>
                  <span className="text-gray-500">Dimensions:</span>
                  <p className="font-medium text-gray-900">
                    {selected.width} x {selected.height}
                  </p>
                </div>
              )}
              {selected.duration_seconds && (
                <div>
                  <span className="text-gray-500">Duration:</span>
                  <p className="font-medium text-gray-900">
                    {Math.round(selected.duration_seconds)}s
                  </p>
                </div>
              )}
              <div>
                <span className="text-gray-500">Uploaded:</span>
                <p className="font-medium text-gray-900">
                  {format(new Date(selected.created_at), 'MMM d, yyyy h:mm a')}
                </p>
              </div>
            </div>

            <button
              onClick={() => deleteMutation.mutate(selected.id)}
              disabled={deleteMutation.isPending}
              className="mt-6 w-full py-2.5 bg-red-50 text-red-600 border border-red-200 rounded-lg font-medium hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 size={16} />
              Delete Asset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
