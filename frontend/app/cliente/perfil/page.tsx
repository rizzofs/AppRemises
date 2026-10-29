'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAppTracking } from '@/hooks/useAppTracking';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import ThemeToggle from '@/components/ThemeToggle';
import { clienteService, coordinadorDashboardService } from '@/lib/api';
import { DireccionFrecuente } from '@/types';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Edit,
  Save,
  X,
  ArrowLeft,
  Moon,
  Camera,
  Plus,
  Trash2,
  Home,
  Briefcase,
  Dumbbell,
  Heart,
  GraduationCap,
  Upload,
  Bookmark,
  Check,
} from 'lucide-react';
import Link from 'next/link';

interface ProfileFormData {
  nombre: string;
  apellido: string;
  telefono: string;
  direccion: string;
  genero: string;
}

const PRESET_ALIASES = [
  { label: 'Casa', icon: 'home' },
  { label: 'Trabajo', icon: 'briefcase' },
  { label: 'Gimnasio', icon: 'dumbbell' },
  { label: 'Estudio / Facultad', icon: 'graduation' },
  { label: 'Pareja / Familia', icon: 'heart' },
  { label: 'Otro', icon: 'map-pin' },
];

export default function ClientePerfilPage() {
  const { user, updateUser } = useAuth();
  useAppTracking('CLIENTE_PROFILE_ACCESS');

  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Modal Foto de Perfil
  const [modalFoto, setModalFoto] = useState(false);
  const [fotoPreview, setFotoPreview] = useState<string>('');
  const [fotoUrlInput, setFotoUrlInput] = useState<string>('');
  const [guardandoFoto, setGuardandoFoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Direcciones Frecuentes
  const [direcciones, setDirecciones] = useState<DireccionFrecuente[]>([]);
  const [modalDireccion, setModalDireccion] = useState(false);
  const [direccionEditando, setDireccionEditando] = useState<DireccionFrecuente | null>(null);
  const [aliasForm, setAliasForm] = useState('Casa');
  const [iconoForm, setIconoForm] = useState('home');
  const [direccionForm, setDireccionForm] = useState('');
  const [pisoDeptoForm, setPisoDeptoForm] = useState('');
  const [referenciaForm, setReferenciaForm] = useState('');
  const [guardandoDireccion, setGuardandoDireccion] = useState(false);
  const [sugerenciasDireccion, setSugerenciasDireccion] = useState<any[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfileFormData>();

  useEffect(() => {
    if (user?.cliente) {
      reset({
        nombre: user.cliente.nombre,
        apellido: user.cliente.apellido,
        telefono: user.cliente.telefono,
        direccion: user.cliente.direccion,
        genero: user.cliente.genero || '',
      });

      // Parsear direcciones frecuentes si existen
      if (user.cliente.direccionesFrecuentes) {
        try {
          if (Array.isArray(user.cliente.direccionesFrecuentes)) {
            setDirecciones(user.cliente.direccionesFrecuentes);
          } else if (typeof user.cliente.direccionesFrecuentes === 'string') {
            const parsed = JSON.parse(user.cliente.direccionesFrecuentes);
            if (Array.isArray(parsed)) {
              setDirecciones(parsed);
            }
          }
        } catch {
          setDirecciones([]);
        }
      }
    }
  }, [user, reset]);

  // Autocompletado de dirección al agregar dirección frecuente
  useEffect(() => {
    if (!direccionForm || direccionForm.length < 3) {
      setSugerenciasDireccion([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await coordinadorDashboardService.geocode(direccionForm);
        if (res.success && res.data) {
          setSugerenciasDireccion(res.data.slice(0, 4));
        }
      } catch (e) {
        console.error('Error buscando dirección:', e);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [direccionForm]);

  const onSubmit = async (data: ProfileFormData) => {
    setIsLoading(true);

    try {
      const res = await clienteService.updateProfile(data);

      if (res.success && res.data) {
        toast.success('Perfil actualizado exitosamente');
        setIsEditing(false);
        if (user && user.cliente) {
          updateUser({
            ...user,
            cliente: {
              ...user.cliente,
              ...data,
            },
          });
        }
      } else {
        toast.error(res.message || 'Error al actualizar el perfil');
      }
    } catch (error) {
      console.error('Error actualizando perfil:', error);
      toast.error('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    reset();
    setIsEditing(false);
  };

  // Manejo de archivo de imagen
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen no debe superar los 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setFotoPreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGuardarFoto = async () => {
    const finalFoto = fotoPreview || fotoUrlInput.trim();
    if (!finalFoto) {
      toast.error('Por favor selecciona una foto o introduce un enlace.');
      return;
    }

    try {
      setGuardandoFoto(true);
      const res = await clienteService.updateProfile({ fotoUrl: finalFoto });

      if (res.success) {
        if (user && user.cliente) {
          updateUser({
            ...user,
            cliente: {
              ...user.cliente,
              fotoUrl: finalFoto,
            },
          });
        }
        setModalFoto(false);
        toast.success('¡Foto de perfil actualizada exitosamente!');
      } else {
        toast.error(res.message || 'Error al actualizar la foto');
      }
    } catch (err) {
      console.error('Error al guardar foto:', err);
      toast.error('Error al actualizar la foto');
    } finally {
      setGuardandoFoto(false);
    }
  };

  const handleEliminarFoto = async () => {
    try {
      setGuardandoFoto(true);
      const res = await clienteService.updateProfile({ fotoUrl: null });

      if (res.success) {
        if (user && user.cliente) {
          updateUser({
            ...user,
            cliente: {
              ...user.cliente,
              fotoUrl: null,
            },
          });
        }
        setFotoPreview('');
        setFotoUrlInput('');
        setModalFoto(false);
        toast.success('Foto de perfil eliminada');
      } else {
        toast.error(res.message || 'Error al eliminar la foto');
      }
    } catch (err) {
      console.error('Error al eliminar foto:', err);
      toast.error('Error al eliminar foto');
    } finally {
      setGuardandoFoto(false);
    }
  };

  // Guardar Direcciones Frecuentes
  const abrirModalNuevaDireccion = (aliasInicial = 'Casa', iconoInicial = 'home') => {
    setDireccionEditando(null);
    setAliasForm(aliasInicial);
    setIconoForm(iconoInicial);
    setDireccionForm('');
    setPisoDeptoForm('');
    setReferenciaForm('');
    setSugerenciasDireccion([]);
    setModalDireccion(true);
  };

  const abrirModalEditarDireccion = (dir: DireccionFrecuente) => {
    setDireccionEditando(dir);
    setAliasForm(dir.alias);
    setIconoForm(dir.icono || 'map-pin');
    setDireccionForm(dir.direccion);
    setPisoDeptoForm(dir.pisoDepto || '');
    setReferenciaForm(dir.referencia || '');
    setSugerenciasDireccion([]);
    setModalDireccion(true);
  };

  const handleGuardarDireccionFrecuente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!direccionForm.trim()) {
      toast.error('La dirección es obligatoria');
      return;
    }
    if (!aliasForm.trim()) {
      toast.error('El nombre/alias es obligatorio');
      return;
    }

    setGuardandoDireccion(true);
    try {
      let updatedList: DireccionFrecuente[] = [];

      if (direccionEditando) {
        // Editar existente
        updatedList = direcciones.map((d) =>
          d.id === direccionEditando.id
            ? {
                ...d,
                alias: aliasForm.trim(),
                icono: iconoForm,
                direccion: direccionForm.trim(),
                pisoDepto: pisoDeptoForm.trim() || undefined,
                referencia: referenciaForm.trim() || undefined,
              }
            : d
        );
      } else {
        // Crear nueva
        const nuevaDir: DireccionFrecuente = {
          id: Date.now().toString(),
          alias: aliasForm.trim(),
          icono: iconoForm,
          direccion: direccionForm.trim(),
          pisoDepto: pisoDeptoForm.trim() || undefined,
          referencia: referenciaForm.trim() || undefined,
        };
        updatedList = [...direcciones, nuevaDir];
      }

      const res = await clienteService.updateProfile({
        direccionesFrecuentes: updatedList,
      });

      if (res.success) {
        setDirecciones(updatedList);
        if (user && user.cliente) {
          updateUser({
            ...user,
            cliente: {
              ...user.cliente,
              direccionesFrecuentes: updatedList,
            },
          });
        }
        setModalDireccion(false);
        toast.success(
          direccionEditando
            ? 'Dirección actualizada con éxito'
            : '¡Dirección frecuente guardada con éxito!'
        );
      } else {
        toast.error(res.message || 'Error al guardar la dirección');
      }
    } catch (err) {
      console.error('Error guardando dirección frecuente:', err);
      toast.error('Error al guardar la dirección');
    } finally {
      setGuardandoDireccion(false);
    }
  };

  const handleEliminarDireccion = async (id: string) => {
    const updatedList = direcciones.filter((d) => d.id !== id);

    try {
      const res = await clienteService.updateProfile({
        direccionesFrecuentes: updatedList,
      });

      if (res.success) {
        setDirecciones(updatedList);
        if (user && user.cliente) {
          updateUser({
            ...user,
            cliente: {
              ...user.cliente,
              direccionesFrecuentes: updatedList,
            },
          });
        }
        toast.success('Dirección eliminada');
      } else {
        toast.error('Error al eliminar la dirección');
      }
    } catch (e) {
      toast.error('Error de conexión');
    }
  };

  const renderIcono = (icono?: string) => {
    switch (icono) {
      case 'home':
        return <Home className="w-5 h-5 text-emerald-500" />;
      case 'briefcase':
        return <Briefcase className="w-5 h-5 text-blue-500" />;
      case 'dumbbell':
        return <Dumbbell className="w-5 h-5 text-purple-500" />;
      case 'heart':
        return <Heart className="w-5 h-5 text-rose-500" />;
      case 'graduation':
        return <GraduationCap className="w-5 h-5 text-amber-500" />;
      default:
        return <MapPin className="w-5 h-5 text-primary-500" />;
    }
  };

  const getGeneroText = (genero?: string) => {
    switch (genero) {
      case 'M':
        return 'Masculino';
      case 'F':
        return 'Femenino';
      case 'O':
        return 'Otro';
      default:
        return 'No especificado';
    }
  };

  if (!user?.cliente) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 dark:text-slate-400">Cargando perfil...</p>
        </div>
      </div>
    );
  }

  const fotoActual = user.cliente.fotoUrl;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-slate-100 transition-colors pb-24">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 shadow-2xs border-b border-gray-200 dark:border-slate-800 transition-colors sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center space-x-3">
              <Link
                href="/cliente/app"
                className="p-2 text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Mi Perfil</h1>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  Gestiona tu foto, direcciones y datos personales
                </p>
              </div>
            </div>

            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center space-x-1.5 px-3.5 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-all font-semibold text-xs shadow-xs"
              >
                <Edit className="h-3.5 w-3.5" />
                <span>Editar Datos</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* TARJETA 1: FOTO DE PERFIL DEL CLIENTE */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xs border border-gray-200 dark:border-slate-800 p-5 transition-colors">
          <div className="flex flex-col sm:flex-row items-center gap-5">
            {/* Avatar / Imagen */}
            <div className="relative group shrink-0">
              {fotoActual ? (
                <img
                  src={fotoActual}
                  alt={`${user.cliente.nombre} ${user.cliente.apellido}`}
                  className="w-24 h-24 rounded-full object-cover border-4 border-primary-500 shadow-md"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-primary-600 to-primary-400 text-white flex items-center justify-center font-black text-2xl shadow-md border-4 border-white dark:border-slate-800">
                  {user.cliente.nombre?.[0]?.toUpperCase()}
                  {user.cliente.apellido?.[0]?.toUpperCase()}
                </div>
              )}
              <button
                onClick={() => {
                  setFotoPreview(fotoActual || '');
                  setFotoUrlInput('');
                  setModalFoto(true);
                }}
                className="absolute bottom-0 right-0 p-2 bg-primary-600 text-white rounded-full shadow-lg hover:bg-primary-700 transition-transform active:scale-95 border-2 border-white dark:border-slate-900"
                title="Cambiar foto de perfil"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>

            {/* Datos del Cliente y Explicación */}
            <div className="flex-1 text-center sm:text-left space-y-1.5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <h2 className="text-lg font-black text-gray-900 dark:text-white">
                  {user.cliente.nombre} {user.cliente.apellido}
                </h2>
                <span className="inline-block text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary-50 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800/60 w-fit mx-auto sm:mx-0">
                  Pasajero Verificado
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
                {fotoActual ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    ✓ Tu foto está activa. Los choferes podrán reconocerte fácilmente cuando lleguen a buscarte.
                  </span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400 font-medium">
                    ⚠️ Aún no has cargado tu foto. Te recomendamos subir una para que el chofer sepa a quién va a buscar y agilice tu viaje.
                  </span>
                )}
              </p>
              <div>
                <button
                  onClick={() => {
                    setFotoPreview(fotoActual || '');
                    setFotoUrlInput('');
                    setModalFoto(true);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-600 dark:text-primary-400 hover:underline pt-1"
                >
                  <Camera className="w-3.5 h-3.5" />
                  {fotoActual ? 'Cambiar o actualizar foto' : 'Subir mi foto de perfil'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* TARJETA 2: DIRECCIONES FRECUENTES / FAVORITAS (3 O MÁS) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xs border border-gray-200 dark:border-slate-800 p-5 transition-colors space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-primary-50 dark:bg-slate-800 text-primary-600 dark:text-primary-400">
                <Bookmark className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white">
                  Mis Direcciones Frecuentes
                </h2>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  Guardá tus lugares habituales (Casa, Trabajo, Gimnasio) para pedir auto con un toque
                </p>
              </div>
            </div>

            <button
              onClick={() => abrirModalNuevaDireccion('Casa', 'home')}
              className="flex items-center gap-1 px-3 py-1.5 bg-primary-50 dark:bg-primary-950 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800 rounded-xl text-xs font-bold hover:bg-primary-100 transition-colors shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Agregar</span>
            </button>
          </div>

          {/* Lista de direcciones guardadas */}
          {direcciones.length === 0 ? (
            <div className="bg-slate-50 dark:bg-slate-800/40 border border-dashed border-gray-200 dark:border-slate-700/80 rounded-2xl p-6 text-center space-y-3">
              <MapPin className="w-8 h-8 text-gray-400 mx-auto" />
              <div>
                <p className="text-sm font-bold text-gray-700 dark:text-slate-300">
                  No tienes direcciones frecuentes guardadas
                </p>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                  Agregá al menos 3 direcciones donde sueles pedir el auto para ahorrar tiempo al viajar.
                </p>
              </div>
              {/* Botones de sugerencias rápidas */}
              <div className="flex flex-wrap justify-center gap-2 pt-1">
                <button
                  onClick={() => abrirModalNuevaDireccion('Casa', 'home')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-gray-700 dark:text-slate-200 hover:border-primary-500 shadow-2xs"
                >
                  <Home className="w-3.5 h-3.5 text-emerald-500" />
                  + Agregar Casa
                </button>
                <button
                  onClick={() => abrirModalNuevaDireccion('Trabajo', 'briefcase')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-gray-700 dark:text-slate-200 hover:border-primary-500 shadow-2xs"
                >
                  <Briefcase className="w-3.5 h-3.5 text-blue-500" />
                  + Agregar Trabajo
                </button>
                <button
                  onClick={() => abrirModalNuevaDireccion('Gimnasio', 'dumbbell')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-gray-700 dark:text-slate-200 hover:border-primary-500 shadow-2xs"
                >
                  <Dumbbell className="w-3.5 h-3.5 text-purple-500" />
                  + Agregar Gimnasio
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {direcciones.map((dir) => (
                <div
                  key={dir.id}
                  className="bg-slate-50/70 dark:bg-slate-800/60 border border-gray-200/80 dark:border-slate-700/60 rounded-xl p-3.5 flex items-start justify-between gap-3 hover:border-gray-300 dark:hover:border-slate-600 transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 shrink-0 shadow-2xs">
                      {renderIcono(dir.icono)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm text-gray-900 dark:text-white truncate">
                          {dir.alias}
                        </p>
                      </div>
                      <p className="text-xs text-gray-700 dark:text-slate-300 font-medium truncate mt-0.5">
                        {dir.direccion}
                      </p>
                      {dir.pisoDepto && (
                        <p className="text-[11px] text-gray-500 dark:text-slate-400">
                          {dir.pisoDepto}
                        </p>
                      )}
                      {dir.referencia && (
                        <p className="text-[10px] text-gray-400 dark:text-slate-500 italic truncate">
                          Ref: {dir.referencia}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => abrirModalEditarDireccion(dir)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-lg hover:bg-gray-200/60 dark:hover:bg-slate-700 transition-colors"
                      title="Editar dirección"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleEliminarDireccion(dir.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                      title="Eliminar dirección"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* TARJETA 3: APARIENCIA Y MODO OSCURO */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xs border border-gray-200 dark:border-slate-800 p-5 transition-colors">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="p-2 rounded-xl bg-primary-50 dark:bg-slate-800 text-primary-600 dark:text-primary-400">
              <Moon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                Apariencia y Modo Oscuro
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Selecciona cómo deseas ver la aplicación
              </p>
            </div>
          </div>
          <ThemeToggle variant="inline" />
        </div>

        {/* TARJETA 4: INFORMACIÓN PERSONAL */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xs border border-gray-200 dark:border-slate-800 transition-colors overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Información Personal</h2>
            {!isEditing && (
              <span className="text-xs text-gray-400 dark:text-slate-400">Solo lectura</span>
            )}
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
            {/* Nombre y Apellido */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1.5">
                  Nombre
                </label>
                <div className="relative">
                  <input
                    {...register('nombre', { required: 'El nombre es requerido' })}
                    type="text"
                    disabled={!isEditing}
                    className={`w-full pl-9 pr-3 py-2.5 border rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary-500 transition-colors ${
                      !isEditing
                        ? 'bg-gray-50 dark:bg-slate-800/60 text-gray-600 dark:text-slate-400 border-gray-200 dark:border-slate-700'
                        : 'bg-white dark:bg-slate-800 text-gray-900 dark:text-white border-gray-300 dark:border-slate-600'
                    }`}
                  />
                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                </div>
                {errors.nombre && (
                  <p className="mt-1 text-xs text-red-600">{errors.nombre.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1.5">
                  Apellido
                </label>
                <div className="relative">
                  <input
                    {...register('apellido', { required: 'El apellido es requerido' })}
                    type="text"
                    disabled={!isEditing}
                    className={`w-full pl-9 pr-3 py-2.5 border rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary-500 transition-colors ${
                      !isEditing
                        ? 'bg-gray-50 dark:bg-slate-800/60 text-gray-600 dark:text-slate-400 border-gray-200 dark:border-slate-700'
                        : 'bg-white dark:bg-slate-800 text-gray-900 dark:text-white border-gray-300 dark:border-slate-600'
                    }`}
                  />
                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                </div>
                {errors.apellido && (
                  <p className="mt-1 text-xs text-red-600">{errors.apellido.message}</p>
                )}
              </div>
            </div>

            {/* Email y Teléfono */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1.5">
                  Email
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={user.cliente.email}
                    disabled
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-gray-50 dark:bg-slate-800/60 text-gray-500 dark:text-slate-400 text-xs font-medium"
                  />
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                </div>
                <p className="mt-1 text-[10px] text-gray-400">El email no se puede modificar</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1.5">
                  Teléfono
                </label>
                <div className="relative">
                  <input
                    {...register('telefono', { required: 'El teléfono es requerido' })}
                    type="tel"
                    disabled={!isEditing}
                    className={`w-full pl-9 pr-3 py-2.5 border rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary-500 transition-colors ${
                      !isEditing
                        ? 'bg-gray-50 dark:bg-slate-800/60 text-gray-600 dark:text-slate-400 border-gray-200 dark:border-slate-700'
                        : 'bg-white dark:bg-slate-800 text-gray-900 dark:text-white border-gray-300 dark:border-slate-600'
                    }`}
                  />
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                </div>
                {errors.telefono && (
                  <p className="mt-1 text-xs text-red-600">{errors.telefono.message}</p>
                )}
              </div>
            </div>

            {/* Dirección Predeterminada */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1.5">
                Dirección Principal (Domicilio)
              </label>
              <div className="relative">
                <input
                  {...register('direccion', { required: 'La dirección es requerida' })}
                  type="text"
                  disabled={!isEditing}
                  className={`w-full pl-9 pr-3 py-2.5 border rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary-500 transition-colors ${
                    !isEditing
                      ? 'bg-gray-50 dark:bg-slate-800/60 text-gray-600 dark:text-slate-400 border-gray-200 dark:border-slate-700'
                      : 'bg-white dark:bg-slate-800 text-gray-900 dark:text-white border-gray-300 dark:border-slate-600'
                  }`}
                />
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              </div>
              {errors.direccion && (
                <p className="mt-1 text-xs text-red-600">{errors.direccion.message}</p>
              )}
            </div>

            {/* DNI y Fecha Nacimiento */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1.5">
                  DNI
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={user.cliente.dni}
                    disabled
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-gray-50 dark:bg-slate-800/60 text-gray-500 dark:text-slate-400 text-xs font-medium"
                  />
                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1.5">
                  Fecha de Nacimiento
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={new Date(user.cliente.fechaNacimiento).toLocaleDateString('es-AR')}
                    disabled
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-gray-50 dark:bg-slate-800/60 text-gray-500 dark:text-slate-400 text-xs font-medium"
                  />
                  <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                </div>
              </div>
            </div>

            {/* Género */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1.5">
                Género
              </label>
              {isEditing ? (
                <select
                  {...register('genero')}
                  className="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-xl text-xs font-medium bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Seleccionar</option>
                  <option value="M">Masculino</option>
                  <option value="F">Femenino</option>
                  <option value="O">Otro</option>
                </select>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={getGeneroText(user.cliente.genero)}
                    disabled
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-gray-50 dark:bg-slate-800/60 text-gray-500 dark:text-slate-400 text-xs font-medium"
                  />
                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                </div>
              )}
            </div>

            {/* Botones de acción al editar */}
            {isEditing && (
              <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 bg-primary-600 text-white py-2.5 rounded-xl font-bold text-xs hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <Save className="h-4 w-4" />
                  <span>{isLoading ? 'Guardando...' : 'Guardar Cambios'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="flex-1 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 py-2.5 rounded-xl font-bold text-xs hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-1.5"
                >
                  <X className="h-4 w-4" />
                  <span>Cancelar</span>
                </button>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* MODAL 1: FOTO DE PERFIL */}
      {modalFoto && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl border border-gray-100 dark:border-slate-800">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                <h3 className="font-bold text-sm text-gray-900 dark:text-white">Foto de Perfil</h3>
              </div>
              <button
                onClick={() => setModalFoto(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
              Subí una foto clara de tu rostro para que el chofer sepa a quién va a buscar cuando llegue a tu ubicación.
            </p>

            {/* Vista Previa de la Foto */}
            <div className="flex flex-col items-center justify-center py-2">
              {fotoPreview || fotoUrlInput ? (
                <div className="relative">
                  <img
                    src={fotoPreview || fotoUrlInput}
                    alt="Vista previa"
                    className="w-28 h-28 rounded-full object-cover border-4 border-primary-500 shadow-md"
                  />
                  <button
                    onClick={() => {
                      setFotoPreview('');
                      setFotoUrlInput('');
                    }}
                    className="absolute -top-1 -right-1 p-1 bg-red-600 text-white rounded-full shadow"
                    title="Quitar vista previa"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="w-28 h-28 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-gray-300 dark:border-slate-700 flex flex-col items-center justify-center text-gray-400 text-xs gap-1">
                  <User className="w-8 h-8" />
                  <span>Sin foto</span>
                </div>
              )}
            </div>

            {/* Opción 1: Subir Archivo */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-2.5 px-3 bg-primary-50 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-primary-100 transition-colors"
            >
              <Upload className="w-4 h-4" />
              <span>Seleccionar de la Galería o Cámara</span>
            </button>

            {/* Opción 2: Pegar URL */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-gray-500 dark:text-slate-400">
                O ingresa un enlace / URL de imagen:
              </label>
              <input
                type="url"
                value={fotoUrlInput}
                onChange={(e) => setFotoUrlInput(e.target.value)}
                placeholder="https://ejemplo.com/mi-foto.jpg"
                className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500 font-medium"
              />
            </div>

            {/* Acciones */}
            <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
              {fotoActual && (
                <button
                  type="button"
                  onClick={handleEliminarFoto}
                  disabled={guardandoFoto}
                  className="px-3 py-2 bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 rounded-xl text-xs font-bold hover:bg-red-100 transition-colors"
                >
                  Eliminar
                </button>
              )}
              <button
                type="button"
                onClick={handleGuardarFoto}
                disabled={guardandoFoto || (!fotoPreview && !fotoUrlInput.trim())}
                className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-xs font-bold hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Check className="w-4 h-4" />
                <span>{guardandoFoto ? 'Guardando...' : 'Guardar Foto'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: AGREGAR O EDITAR DIRECCIÓN FRECUENTE */}
      {modalDireccion && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl border border-gray-100 dark:border-slate-800">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Bookmark className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                <h3 className="font-bold text-sm text-gray-900 dark:text-white">
                  {direccionEditando ? 'Editar Dirección Frecuente' : 'Nueva Dirección Frecuente'}
                </h3>
              </div>
              <button
                onClick={() => setModalDireccion(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleGuardarDireccionFrecuente} className="space-y-3.5 text-xs">
              {/* Selector Rápido de Tipo / Icono */}
              <div>
                <label className="block text-[11px] font-bold text-gray-600 dark:text-slate-400 mb-1.5">
                  Tipo de Lugar
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {PRESET_ALIASES.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => {
                        setAliasForm(p.label);
                        setIconoForm(p.icon);
                      }}
                      className={`p-2 rounded-xl border text-center flex items-center justify-center gap-1.5 font-bold transition-all ${
                        aliasForm === p.label
                          ? 'bg-primary-50 dark:bg-primary-950/60 border-primary-500 text-primary-700 dark:text-primary-300 shadow-2xs'
                          : 'bg-gray-50 dark:bg-slate-800/60 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-100'
                      }`}
                    >
                      {renderIcono(p.icon)}
                      <span className="truncate">{p.label.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Nombre / Alias personalizado */}
              <div>
                <label className="block text-[11px] font-bold text-gray-600 dark:text-slate-400 mb-1">
                  Nombre o Alias (ej: Casa, Oficina, Gym)
                </label>
                <input
                  type="text"
                  value={aliasForm}
                  onChange={(e) => setAliasForm(e.target.value)}
                  placeholder="Ej: Casa, Trabajo, Gimnasio"
                  required
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs text-gray-900 dark:text-white font-medium focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              {/* Dirección con autocompletado */}
              <div className="relative">
                <label className="block text-[11px] font-bold text-gray-600 dark:text-slate-400 mb-1">
                  Calle y Altura (Dirección)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={direccionForm}
                    onChange={(e) => setDireccionForm(e.target.value)}
                    placeholder="Ej: Av. Sarmiento 340, Chivilcoy"
                    required
                    className="w-full pl-8 pr-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs text-gray-900 dark:text-white font-medium focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                  <MapPin className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
                </div>

                {/* Sugerencias de autocompletado */}
                {sugerenciasDireccion.length > 0 && (
                  <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg z-20 overflow-hidden divide-y divide-gray-100 dark:divide-slate-700">
                    {sugerenciasDireccion.map((sug, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setDireccionForm(sug.display_name);
                          setSugerenciasDireccion([]);
                        }}
                        className="w-full px-3 py-2 text-left text-[11px] text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-start gap-2"
                      >
                        <MapPin className="w-3.5 h-3.5 text-primary-500 shrink-0 mt-0.5" />
                        <span className="truncate">{sug.display_name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Piso / Depto y Referencias */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 dark:text-slate-400 mb-1">
                    Piso / Depto (opcional)
                  </label>
                  <input
                    type="text"
                    value={pisoDeptoForm}
                    onChange={(e) => setPisoDeptoForm(e.target.value)}
                    placeholder="Ej: 2° B, Timbre 4"
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs text-gray-900 dark:text-white font-medium focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 dark:text-slate-400 mb-1">
                    Indicaciones (opcional)
                  </label>
                  <input
                    type="text"
                    value={referenciaForm}
                    onChange={(e) => setReferenciaForm(e.target.value)}
                    placeholder="Ej: Portón negro"
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs text-gray-900 dark:text-white font-medium focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
              </div>

              {/* Botón Guardar */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={guardandoDireccion}
                  className="w-full py-2.5 bg-primary-600 text-white rounded-xl text-xs font-bold hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <Save className="w-4 h-4" />
                  <span>{guardandoDireccion ? 'Guardando...' : 'Guardar Dirección Frecuente'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
