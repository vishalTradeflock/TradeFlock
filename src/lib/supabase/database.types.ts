export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      authors: {
        Row: {
          id: string;
          name: string;
          slug: string;
          bio: string | null;
          title: string | null;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          bio?: string | null;
          title?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          bio?: string | null;
          title?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      articles: {
        Row: {
          id: string;
          slug: string;
          title: string;
          dek: string | null;
          excerpt: string;
          meta_title: string | null;
          meta_description: string | null;
          body: string;
          cover_image_url: string;
          cover_image_alt: string;
          category_id: string;
          author_id: string;
          is_featured: boolean;
          is_breaking: boolean;
          view_count: number;
          status: "draft" | "review" | "published";
          published_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          title: string;
          dek?: string | null;
          excerpt: string;
          meta_title?: string | null;
          meta_description?: string | null;
          body: string;
          cover_image_url: string;
          cover_image_alt?: string;
          category_id: string;
          author_id: string;
          is_featured?: boolean;
          is_breaking?: boolean;
          view_count?: number;
          status?: "draft" | "review" | "published";
          published_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          title?: string;
          dek?: string | null;
          excerpt?: string;
          meta_title?: string | null;
          meta_description?: string | null;
          body?: string;
          cover_image_url?: string;
          cover_image_alt?: string;
          category_id?: string;
          author_id?: string;
          is_featured?: boolean;
          is_breaking?: boolean;
          view_count?: number;
          status?: "draft" | "review" | "published";
          published_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "articles_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "authors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "articles_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      magazines: {
        Row: {
          id: string;
          slug: string;
          title: string;
          description: string | null;
          cover_image_url: string | null;
          pdf_url: string | null;
          published_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          title: string;
          description?: string | null;
          cover_image_url?: string | null;
          pdf_url?: string | null;
          published_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          title?: string;
          description?: string | null;
          cover_image_url?: string | null;
          pdf_url?: string | null;
          published_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      processed_leads: {
        Row: {
          id: string;
          title: string;
          title_key: string;
          source_url: string | null;
          source_name: string | null;
          desk: string | null;
          outcome: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          title_key: string;
          source_url?: string | null;
          source_name?: string | null;
          desk?: string | null;
          outcome?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          title_key?: string;
          source_url?: string | null;
          source_name?: string | null;
          desk?: string | null;
          outcome?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          role: "writer" | "moderator" | "editor" | "admin";
          display_name: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          role?: "writer" | "moderator" | "editor" | "admin";
          display_name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          role?: "writer" | "moderator" | "editor" | "admin";
          display_name?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      ensure_studio_author: {
        Args: { p_user_id: string };
        Returns: string;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
