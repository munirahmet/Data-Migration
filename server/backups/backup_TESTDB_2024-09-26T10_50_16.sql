PGDMP      2    
            |            Testdb    15.7    16.3     �           0    0    ENCODING    ENCODING        SET client_encoding = 'UTF8';
                      false            �           0    0 
   STDSTRINGS 
   STDSTRINGS     (   SET standard_conforming_strings = 'on';
                      false            �           0    0 
   SEARCHPATH 
   SEARCHPATH     8   SELECT pg_catalog.set_config('search_path', '', false);
                      false            �           1262    16399    Testdb    DATABASE     }   CREATE DATABASE "Testdb" WITH TEMPLATE = template0 ENCODING = 'UTF8' LOCALE_PROVIDER = libc LOCALE = 'Turkish_T�rkiye.1254';
    DROP DATABASE "Testdb";
                postgres    false            �            1259    17415    otomobil_fiyatlari    TABLE     �  CREATE TABLE public.otomobil_fiyatlari (
    id integer NOT NULL,
    marka character varying(50) NOT NULL,
    model character varying(50) NOT NULL,
    donanim character varying(200) NOT NULL,
    motor character varying(50) NOT NULL,
    yakit character varying(50) NOT NULL,
    vites character varying(50) NOT NULL,
    fiyat integer NOT NULL,
    websitesi character varying(50) NOT NULL
);
 &   DROP TABLE public.otomobil_fiyatlari;
       public         heap    postgres    false            �            1259    17420    otomobil_fiyatlari_id_seq    SEQUENCE     �   CREATE SEQUENCE public.otomobil_fiyatlari_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 0   DROP SEQUENCE public.otomobil_fiyatlari_id_seq;
       public          postgres    false    214            �           0    0    otomobil_fiyatlari_id_seq    SEQUENCE OWNED BY     W   ALTER SEQUENCE public.otomobil_fiyatlari_id_seq OWNED BY public.otomobil_fiyatlari.id;
          public          postgres    false    215            e           2604    17421    otomobil_fiyatlari id    DEFAULT     ~   ALTER TABLE ONLY public.otomobil_fiyatlari ALTER COLUMN id SET DEFAULT nextval('public.otomobil_fiyatlari_id_seq'::regclass);
 D   ALTER TABLE public.otomobil_fiyatlari ALTER COLUMN id DROP DEFAULT;
       public          postgres    false    215    214            �          0    17415    otomobil_fiyatlari 
   TABLE DATA           n   COPY public.otomobil_fiyatlari (id, marka, model, donanim, motor, yakit, vites, fiyat, websitesi) FROM stdin;
    public          postgres    false    214   �       �           0    0    otomobil_fiyatlari_id_seq    SEQUENCE SET     H   SELECT pg_catalog.setval('public.otomobil_fiyatlari_id_seq', 1, false);
          public          postgres    false    215            g           2606    17423 *   otomobil_fiyatlari otomobil_fiyatlari_pkey 
   CONSTRAINT     h   ALTER TABLE ONLY public.otomobil_fiyatlari
    ADD CONSTRAINT otomobil_fiyatlari_pkey PRIMARY KEY (id);
 T   ALTER TABLE ONLY public.otomobil_fiyatlari DROP CONSTRAINT otomobil_fiyatlari_pkey;
       public            postgres    false    214            �   o  x����r�0�x�=��d}ؽ�f��U�3�^pO�f�3Ly*���`�!)P$Yi��h�߻�`�%�i��JD{�=Hz	�nVl���r�V�7��C����V�:��f�N��u}�=+��j�i�˂��y�6�夹�{^�&Z�)"m���ķ�h
�O!t���~7�w$�.|Ź�q^��E�q/��ҳ��)=���w��|�%,,~eeU��OD!���v����9�3�����7�B�r����I��d:��Fq�� �����e�0�f���E���g�;4@}�Fh��9��S�.o���)"�z�a���y�,7�\W�L�������3�ͅ?�t�� �j]�a�`��/4Y��f��!�W��#���!��c�W/Q�#�A�:\1%�!	����#���!�]5��s�#�z��:/�RcN���÷f���";���&C��D�M���;G��7x��w�ӺE��cB�?d����\/3��S�fL8.�c�	S���O9�C��%�iJ.��r����KQ��z�ڑ�c�]���^5��A�0(�J|�O�P���)3P��R��b��:�̌:<�M)8���R�~}x���a�����>�[��opn�D     