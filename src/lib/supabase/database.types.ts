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
          magazine_id: string | null;
          magazine_sort: number | null;
          magazine_page: number | null;
          designation: string | null;
          subheading: string | null;
          company: string | null;
          bio: string | null;
          linkedin_url: string | null;
          website_url: string | null;
          flipbook_url: string | null;
          canonical_url: string | null;
          featured_image: string | null;
          featured_image_alt: string | null;
          image_url: string | null;
          faqs: Json;
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
          magazine_id?: string | null;
          magazine_sort?: number | null;
          magazine_page?: number | null;
          designation?: string | null;
          subheading?: string | null;
          company?: string | null;
          bio?: string | null;
          linkedin_url?: string | null;
          website_url?: string | null;
          flipbook_url?: string | null;
          canonical_url?: string | null;
          featured_image?: string | null;
          featured_image_alt?: string | null;
          image_url?: string | null;
          faqs?: Json;
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
          magazine_id?: string | null;
          magazine_sort?: number | null;
          magazine_page?: number | null;
          designation?: string | null;
          subheading?: string | null;
          company?: string | null;
          bio?: string | null;
          linkedin_url?: string | null;
          website_url?: string | null;
          flipbook_url?: string | null;
          canonical_url?: string | null;
          featured_image?: string | null;
          featured_image_alt?: string | null;
          image_url?: string | null;
          faqs?: Json;
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
          {
            foreignKeyName: "articles_magazine_id_fkey";
            columns: ["magazine_id"];
            isOneToOne: false;
            referencedRelation: "magazines";
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
          cover_image: string | null;
          cover_image_url: string | null;
          pdf_url: string | null;
          flipbook_url: string | null;
          honorees: Json;
          year: number | null;
          status: "draft" | "published";
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
          flipbook_url?: string | null;
          honorees?: Json;
          year?: number | null;
          status?: "draft" | "published";
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
          flipbook_url?: string | null;
          honorees?: Json;
          year?: number | null;
          status?: "draft" | "published";
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
      site_settings: {
        Row: {
          id: string;
          header_scripts: string | null;
          google_site_verification: string | null;
          bing_site_verification: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          header_scripts?: string | null;
          google_site_verification?: string | null;
          bing_site_verification?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          header_scripts?: string | null;
          google_site_verification?: string | null;
          bing_site_verification?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      article_slug_redirects: {
        Row: {
          old_slug: string;
          article_id: string;
          created_at: string;
        };
        Insert: {
          old_slug: string;
          article_id: string;
          created_at?: string;
        };
        Update: {
          old_slug?: string;
          article_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "article_slug_redirects_article_id_fkey";
            columns: ["article_id"];
            isOneToOne: false;
            referencedRelation: "articles";
            referencedColumns: ["id"];
          },
        ];
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
