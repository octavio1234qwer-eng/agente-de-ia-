
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "admin_audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"created_at": string,"details": Json | null,"entity": string,"entity_id": string | null,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"details"?: Json | null,"entity": string,"entity_id"?: string | null,"id"?: string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"details"?: Json | null,"entity"?: string,"entity_id"?: string | null,"id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "admin_audit_log_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"ai_conversations": {
                  Row: {
                    "course_id": string | null,"created_at": string,"id": string,"lesson_id": string | null,"title": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "course_id"?: string | null,"created_at"?: string,"id"?: string,"lesson_id"?: string | null,"title"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "course_id"?: string | null,"created_at"?: string,"id"?: string,"lesson_id"?: string | null,"title"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_conversations_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ai_conversations_lesson_id_fkey"
      columns: ["lesson_id"]
isOneToOne: false
      referencedRelation: "lessons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ai_conversations_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"ai_messages": {
                  Row: {
                    "content": string,"conversation_id": string,"created_at": string,"id": string,"input_tokens": number | null,"output_tokens": number | null,"role": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "content": string,"conversation_id": string,"created_at"?: string,"id"?: string,"input_tokens"?: number | null,"output_tokens"?: number | null,"role": string,"user_id": string
                  }
                  Update: {
                    "content"?: string,"conversation_id"?: string,"created_at"?: string,"id"?: string,"input_tokens"?: number | null,"output_tokens"?: number | null,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_messages_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "ai_conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ai_messages_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"bundle_courses": {
                  Row: {
                    "bundle_id": string,"course_id": string,"position": number
                  }
                  ComputedFields: never
                  Insert: {
                    "bundle_id": string,"course_id": string,"position"?: number
                  }
                  Update: {
                    "bundle_id"?: string,"course_id"?: string,"position"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "bundle_courses_bundle_id_fkey"
      columns: ["bundle_id"]
isOneToOne: false
      referencedRelation: "bundles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bundle_courses_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    }
                  ]
                },"bundles": {
                  Row: {
                    "compare_at_price_cents": number | null,"cover_url": string | null,"created_at": string,"currency": string,"description": string,"id": string,"price_cents": number,"slug": string,"status": Database["public"]['Enums']["publish_status"],"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "compare_at_price_cents"?: number | null,"cover_url"?: string | null,"created_at"?: string,"currency"?: string,"description"?: string,"id"?: string,"price_cents": number,"slug": string,"status"?: Database["public"]['Enums']["publish_status"],"title": string,"updated_at"?: string
                  }
                  Update: {
                    "compare_at_price_cents"?: number | null,"cover_url"?: string | null,"created_at"?: string,"currency"?: string,"description"?: string,"id"?: string,"price_cents"?: number,"slug"?: string,"status"?: Database["public"]['Enums']["publish_status"],"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"cart_items": {
                  Row: {
                    "added_at": string,"bundle_id": string | null,"course_id": string | null,"id": string,"item_type": Database["public"]['Enums']["item_type"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "added_at"?: string,"bundle_id"?: string | null,"course_id"?: string | null,"id"?: string,"item_type": Database["public"]['Enums']["item_type"],"user_id": string
                  }
                  Update: {
                    "added_at"?: string,"bundle_id"?: string | null,"course_id"?: string | null,"id"?: string,"item_type"?: Database["public"]['Enums']["item_type"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cart_items_bundle_id_fkey"
      columns: ["bundle_id"]
isOneToOne: false
      referencedRelation: "bundles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cart_items_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cart_items_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "carts"
      referencedColumns: ["user_id"]
    }
                  ]
                },"carts": {
                  Row: {
                    "reminder_sent_at": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "reminder_sent_at"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "reminder_sent_at"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "carts_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"categories": {
                  Row: {
                    "color": string,"created_at": string,"description": string | null,"icon": string,"id": string,"name": string,"slug": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "color"?: string,"created_at"?: string,"description"?: string | null,"icon"?: string,"id"?: string,"name": string,"slug": string,"sort_order"?: number
                  }
                  Update: {
                    "color"?: string,"created_at"?: string,"description"?: string | null,"icon"?: string,"id"?: string,"name"?: string,"slug"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"certificates": {
                  Row: {
                    "code": string,"completed_at": string,"course_id": string,"course_title": string,"id": string,"instructor_name": string | null,"issued_at": string,"revoked_at": string | null,"student_name": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"completed_at": string,"course_id": string,"course_title": string,"id"?: string,"instructor_name"?: string | null,"issued_at"?: string,"revoked_at"?: string | null,"student_name": string,"user_id": string
                  }
                  Update: {
                    "code"?: string,"completed_at"?: string,"course_id"?: string,"course_title"?: string,"id"?: string,"instructor_name"?: string | null,"issued_at"?: string,"revoked_at"?: string | null,"student_name"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "certificates_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "certificates_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"coupon_redemptions": {
                  Row: {
                    "coupon_id": string,"created_at": string,"id": string,"order_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "coupon_id": string,"created_at"?: string,"id"?: string,"order_id": string,"user_id": string
                  }
                  Update: {
                    "coupon_id"?: string,"created_at"?: string,"id"?: string,"order_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "coupon_redemptions_coupon_id_fkey"
      columns: ["coupon_id"]
isOneToOne: false
      referencedRelation: "coupons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "coupon_redemptions_order_id_fkey"
      columns: ["order_id"]
isOneToOne: true
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "coupon_redemptions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"coupons": {
                  Row: {
                    "code": string,"course_ids": (string)[] | null,"created_at": string,"currency": string,"description": string | null,"discount_type": Database["public"]['Enums']["discount_type"],"discount_value": number,"expires_at": string | null,"id": string,"is_active": boolean,"max_redemptions": number | null,"min_subtotal_cents": number,"per_user_limit": number,"redemptions_count": number,"starts_at": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"course_ids"?: (string)[] | null,"created_at"?: string,"currency"?: string,"description"?: string | null,"discount_type": Database["public"]['Enums']["discount_type"],"discount_value": number,"expires_at"?: string | null,"id"?: string,"is_active"?: boolean,"max_redemptions"?: number | null,"min_subtotal_cents"?: number,"per_user_limit"?: number,"redemptions_count"?: number,"starts_at"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "code"?: string,"course_ids"?: (string)[] | null,"created_at"?: string,"currency"?: string,"description"?: string | null,"discount_type"?: Database["public"]['Enums']["discount_type"],"discount_value"?: number,"expires_at"?: string | null,"id"?: string,"is_active"?: boolean,"max_redemptions"?: number | null,"min_subtotal_cents"?: number,"per_user_limit"?: number,"redemptions_count"?: number,"starts_at"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"courses": {
                  Row: {
                    "category_id": string | null,"compare_at_price_cents": number | null,"cover_url": string | null,"created_at": string,"currency": string,"description": string,"duration_minutes": number,"id": string,"instructor_id": string | null,"is_featured": boolean,"is_free": boolean | null,"language": string,"lessons_count": number,"level": Database["public"]['Enums']["course_level"],"price_cents": number,"promo_video_url": string | null,"published_at": string | null,"rating_avg": number,"rating_count": number,"requirements": (string)[],"slug": string,"status": Database["public"]['Enums']["publish_status"],"students_count": number,"subtitle": string | null,"target_audience": (string)[],"title": string,"updated_at": string,"what_you_will_learn": (string)[]
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id"?: string | null,"compare_at_price_cents"?: number | null,"cover_url"?: string | null,"created_at"?: string,"currency"?: string,"description"?: string,"duration_minutes"?: number,"id"?: string,"instructor_id"?: string | null,"is_featured"?: boolean,"is_free"?: never,"language"?: string,"lessons_count"?: number,"level"?: Database["public"]['Enums']["course_level"],"price_cents"?: number,"promo_video_url"?: string | null,"published_at"?: string | null,"rating_avg"?: number,"rating_count"?: number,"requirements"?: (string)[],"slug": string,"status"?: Database["public"]['Enums']["publish_status"],"students_count"?: number,"subtitle"?: string | null,"target_audience"?: (string)[],"title": string,"updated_at"?: string,"what_you_will_learn"?: (string)[]
                  }
                  Update: {
                    "category_id"?: string | null,"compare_at_price_cents"?: number | null,"cover_url"?: string | null,"created_at"?: string,"currency"?: string,"description"?: string,"duration_minutes"?: number,"id"?: string,"instructor_id"?: string | null,"is_featured"?: boolean,"is_free"?: never,"language"?: string,"lessons_count"?: number,"level"?: Database["public"]['Enums']["course_level"],"price_cents"?: number,"promo_video_url"?: string | null,"published_at"?: string | null,"rating_avg"?: number,"rating_count"?: number,"requirements"?: (string)[],"slug"?: string,"status"?: Database["public"]['Enums']["publish_status"],"students_count"?: number,"subtitle"?: string | null,"target_audience"?: (string)[],"title"?: string,"updated_at"?: string,"what_you_will_learn"?: (string)[]
                  }
                  Relationships: [
                    {
      foreignKeyName: "courses_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "courses_instructor_id_fkey"
      columns: ["instructor_id"]
isOneToOne: false
      referencedRelation: "instructors"
      referencedColumns: ["id"]
    }
                  ]
                },"email_log": {
                  Row: {
                    "created_at": string,"dedupe_key": string | null,"error": string | null,"id": string,"provider_message_id": string | null,"status": Database["public"]['Enums']["email_status"],"subject": string,"template": string,"to_email": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"dedupe_key"?: string | null,"error"?: string | null,"id"?: string,"provider_message_id"?: string | null,"status": Database["public"]['Enums']["email_status"],"subject": string,"template": string,"to_email": string,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"dedupe_key"?: string | null,"error"?: string | null,"id"?: string,"provider_message_id"?: string | null,"status"?: Database["public"]['Enums']["email_status"],"subject"?: string,"template"?: string,"to_email"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "email_log_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"enrollments": {
                  Row: {
                    "completed_at": string | null,"course_id": string,"created_at": string,"id": string,"last_activity_at": string | null,"last_lesson_id": string | null,"order_id": string | null,"progress_percent": number,"reminder_sent_at": string | null,"revoked_at": string | null,"source": Database["public"]['Enums']["enrollment_source"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string | null,"course_id": string,"created_at"?: string,"id"?: string,"last_activity_at"?: string | null,"last_lesson_id"?: string | null,"order_id"?: string | null,"progress_percent"?: number,"reminder_sent_at"?: string | null,"revoked_at"?: string | null,"source": Database["public"]['Enums']["enrollment_source"],"user_id": string
                  }
                  Update: {
                    "completed_at"?: string | null,"course_id"?: string,"created_at"?: string,"id"?: string,"last_activity_at"?: string | null,"last_lesson_id"?: string | null,"order_id"?: string | null,"progress_percent"?: number,"reminder_sent_at"?: string | null,"revoked_at"?: string | null,"source"?: Database["public"]['Enums']["enrollment_source"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "enrollments_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "enrollments_last_lesson_id_fkey"
      columns: ["last_lesson_id"]
isOneToOne: false
      referencedRelation: "lessons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "enrollments_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "enrollments_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"favorites": {
                  Row: {
                    "course_id": string,"created_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "course_id": string,"created_at"?: string,"user_id": string
                  }
                  Update: {
                    "course_id"?: string,"created_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "favorites_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "favorites_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"instructors": {
                  Row: {
                    "avatar_url": string | null,"bio": string | null,"created_at": string,"headline": string | null,"id": string,"is_active": boolean,"linkedin_url": string | null,"name": string,"profile_id": string | null,"slug": string,"updated_at": string,"website_url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"bio"?: string | null,"created_at"?: string,"headline"?: string | null,"id"?: string,"is_active"?: boolean,"linkedin_url"?: string | null,"name": string,"profile_id"?: string | null,"slug": string,"updated_at"?: string,"website_url"?: string | null
                  }
                  Update: {
                    "avatar_url"?: string | null,"bio"?: string | null,"created_at"?: string,"headline"?: string | null,"id"?: string,"is_active"?: boolean,"linkedin_url"?: string | null,"name"?: string,"profile_id"?: string | null,"slug"?: string,"updated_at"?: string,"website_url"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "instructors_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"lesson_contents": {
                  Row: {
                    "body": string,"captions_lang": string,"captions_vtt": string | null,"course_id": string,"has_captions": boolean | null,"lesson_id": string,"search_vector": unknown,"updated_at": string,"video_provider": Database["public"]['Enums']["video_provider"] | null,"video_ref": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string,"captions_lang"?: string,"captions_vtt"?: string | null,"course_id": string,"has_captions"?: never,"lesson_id": string,"search_vector"?: unknown,"updated_at"?: string,"video_provider"?: Database["public"]['Enums']["video_provider"] | null,"video_ref"?: string | null
                  }
                  Update: {
                    "body"?: string,"captions_lang"?: string,"captions_vtt"?: string | null,"course_id"?: string,"has_captions"?: never,"lesson_id"?: string,"search_vector"?: unknown,"updated_at"?: string,"video_provider"?: Database["public"]['Enums']["video_provider"] | null,"video_ref"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "lesson_contents_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lesson_contents_lesson_id_fkey"
      columns: ["lesson_id"]
isOneToOne: true
      referencedRelation: "lessons"
      referencedColumns: ["id"]
    }
                  ]
                },"lesson_notes": {
                  Row: {
                    "body": string,"course_id": string,"created_at": string,"lesson_id": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"course_id": string,"created_at"?: string,"lesson_id": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "body"?: string,"course_id"?: string,"created_at"?: string,"lesson_id"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "lesson_notes_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lesson_notes_lesson_id_fkey"
      columns: ["lesson_id"]
isOneToOne: false
      referencedRelation: "lessons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lesson_notes_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"lesson_progress": {
                  Row: {
                    "completed_at": string | null,"course_id": string,"last_position_seconds": number,"lesson_id": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string | null,"course_id": string,"last_position_seconds"?: number,"lesson_id": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "completed_at"?: string | null,"course_id"?: string,"last_position_seconds"?: number,"lesson_id"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "lesson_progress_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lesson_progress_lesson_id_fkey"
      columns: ["lesson_id"]
isOneToOne: false
      referencedRelation: "lessons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lesson_progress_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"lesson_resources": {
                  Row: {
                    "course_id": string,"created_at": string,"id": string,"is_downloadable": boolean,"lesson_id": string,"mime_type": string | null,"size_bytes": number | null,"storage_path": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "course_id": string,"created_at"?: string,"id"?: string,"is_downloadable"?: boolean,"lesson_id": string,"mime_type"?: string | null,"size_bytes"?: number | null,"storage_path": string,"title": string
                  }
                  Update: {
                    "course_id"?: string,"created_at"?: string,"id"?: string,"is_downloadable"?: boolean,"lesson_id"?: string,"mime_type"?: string | null,"size_bytes"?: number | null,"storage_path"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "lesson_resources_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lesson_resources_lesson_id_fkey"
      columns: ["lesson_id"]
isOneToOne: false
      referencedRelation: "lessons"
      referencedColumns: ["id"]
    }
                  ]
                },"lessons": {
                  Row: {
                    "course_id": string,"created_at": string,"duration_seconds": number,"id": string,"is_preview": boolean,"module_id": string,"pass_percent": number,"position": number,"summary": string | null,"title": string,"type": Database["public"]['Enums']["lesson_type"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "course_id": string,"created_at"?: string,"duration_seconds"?: number,"id"?: string,"is_preview"?: boolean,"module_id": string,"pass_percent"?: number,"position"?: number,"summary"?: string | null,"title": string,"type"?: Database["public"]['Enums']["lesson_type"],"updated_at"?: string
                  }
                  Update: {
                    "course_id"?: string,"created_at"?: string,"duration_seconds"?: number,"id"?: string,"is_preview"?: boolean,"module_id"?: string,"pass_percent"?: number,"position"?: number,"summary"?: string | null,"title"?: string,"type"?: Database["public"]['Enums']["lesson_type"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "lessons_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lessons_module_id_fkey"
      columns: ["module_id"]
isOneToOne: false
      referencedRelation: "modules"
      referencedColumns: ["id"]
    }
                  ]
                },"modules": {
                  Row: {
                    "course_id": string,"created_at": string,"description": string | null,"id": string,"position": number,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "course_id": string,"created_at"?: string,"description"?: string | null,"id"?: string,"position"?: number,"title": string
                  }
                  Update: {
                    "course_id"?: string,"created_at"?: string,"description"?: string | null,"id"?: string,"position"?: number,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "modules_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    }
                  ]
                },"newsletter_subscribers": {
                  Row: {
                    "created_at": string,"email": string,"id": string,"source": string | null,"unsubscribed_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email": string,"id"?: string,"source"?: string | null,"unsubscribed_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"id"?: string,"source"?: string | null,"unsubscribed_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"order_items": {
                  Row: {
                    "bundle_id": string | null,"course_id": string | null,"discount_cents": number,"id": string,"item_type": Database["public"]['Enums']["item_type"],"order_id": string,"title": string,"total_cents": number,"unit_price_cents": number
                  }
                  ComputedFields: never
                  Insert: {
                    "bundle_id"?: string | null,"course_id"?: string | null,"discount_cents"?: number,"id"?: string,"item_type": Database["public"]['Enums']["item_type"],"order_id": string,"title": string,"total_cents": number,"unit_price_cents": number
                  }
                  Update: {
                    "bundle_id"?: string | null,"course_id"?: string | null,"discount_cents"?: number,"id"?: string,"item_type"?: Database["public"]['Enums']["item_type"],"order_id"?: string,"title"?: string,"total_cents"?: number,"unit_price_cents"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_items_bundle_id_fkey"
      columns: ["bundle_id"]
isOneToOne: false
      referencedRelation: "bundles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"orders": {
                  Row: {
                    "billing_details": Json | null,"coupon_code": string | null,"coupon_id": string | null,"created_at": string,"currency": string,"customer_email": string,"customer_name": string | null,"discount_cents": number,"failure_reason": string | null,"id": string,"order_number": string,"paid_at": string | null,"provider": Database["public"]['Enums']["payment_provider"],"provider_payment_id": string | null,"provider_session_id": string | null,"refunded_at": string | null,"refunded_cents": number,"status": Database["public"]['Enums']["order_status"],"subtotal_cents": number,"total_cents": number,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "billing_details"?: Json | null,"coupon_code"?: string | null,"coupon_id"?: string | null,"created_at"?: string,"currency"?: string,"customer_email": string,"customer_name"?: string | null,"discount_cents"?: number,"failure_reason"?: string | null,"id"?: string,"order_number"?: string,"paid_at"?: string | null,"provider": Database["public"]['Enums']["payment_provider"],"provider_payment_id"?: string | null,"provider_session_id"?: string | null,"refunded_at"?: string | null,"refunded_cents"?: number,"status"?: Database["public"]['Enums']["order_status"],"subtotal_cents": number,"total_cents": number,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "billing_details"?: Json | null,"coupon_code"?: string | null,"coupon_id"?: string | null,"created_at"?: string,"currency"?: string,"customer_email"?: string,"customer_name"?: string | null,"discount_cents"?: number,"failure_reason"?: string | null,"id"?: string,"order_number"?: string,"paid_at"?: string | null,"provider"?: Database["public"]['Enums']["payment_provider"],"provider_payment_id"?: string | null,"provider_session_id"?: string | null,"refunded_at"?: string | null,"refunded_cents"?: number,"status"?: Database["public"]['Enums']["order_status"],"subtotal_cents"?: number,"total_cents"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "orders_coupon_id_fkey"
      columns: ["coupon_id"]
isOneToOne: false
      referencedRelation: "coupons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"payment_events": {
                  Row: {
                    "created_at": string,"error": string | null,"event_id": string,"event_type": string,"id": string,"order_id": string | null,"payload": NonNullable<Json>,"processed_at": string | null,"provider": Database["public"]['Enums']["payment_provider"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"error"?: string | null,"event_id": string,"event_type": string,"id"?: string,"order_id"?: string | null,"payload": NonNullable<Json>,"processed_at"?: string | null,"provider": Database["public"]['Enums']["payment_provider"]
                  }
                  Update: {
                    "created_at"?: string,"error"?: string | null,"event_id"?: string,"event_type"?: string,"id"?: string,"order_id"?: string | null,"payload"?: NonNullable<Json>,"processed_at"?: string | null,"provider"?: Database["public"]['Enums']["payment_provider"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "payment_events_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"bio": string | null,"created_at": string,"email": string,"full_name": string,"headline": string | null,"id": string,"last_seen_at": string | null,"marketing_opt_in": boolean,"reminder_opt_in": boolean,"role": Database["public"]['Enums']["user_role"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"bio"?: string | null,"created_at"?: string,"email": string,"full_name"?: string,"headline"?: string | null,"id": string,"last_seen_at"?: string | null,"marketing_opt_in"?: boolean,"reminder_opt_in"?: boolean,"role"?: Database["public"]['Enums']["user_role"],"updated_at"?: string
                  }
                  Update: {
                    "avatar_url"?: string | null,"bio"?: string | null,"created_at"?: string,"email"?: string,"full_name"?: string,"headline"?: string | null,"id"?: string,"last_seen_at"?: string | null,"marketing_opt_in"?: boolean,"reminder_opt_in"?: boolean,"role"?: Database["public"]['Enums']["user_role"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"quiz_attempts": {
                  Row: {
                    "answers": NonNullable<Json>,"course_id": string,"created_at": string,"id": string,"lesson_id": string,"passed": boolean,"score": number,"total": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "answers": NonNullable<Json>,"course_id": string,"created_at"?: string,"id"?: string,"lesson_id": string,"passed": boolean,"score": number,"total": number,"user_id": string
                  }
                  Update: {
                    "answers"?: NonNullable<Json>,"course_id"?: string,"created_at"?: string,"id"?: string,"lesson_id"?: string,"passed"?: boolean,"score"?: number,"total"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "quiz_attempts_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quiz_attempts_lesson_id_fkey"
      columns: ["lesson_id"]
isOneToOne: false
      referencedRelation: "lessons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quiz_attempts_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"quiz_questions": {
                  Row: {
                    "correct_index": number,"course_id": string,"created_at": string,"explanation": string | null,"id": string,"lesson_id": string,"options": NonNullable<Json>,"position": number,"prompt": string
                  }
                  ComputedFields: never
                  Insert: {
                    "correct_index": number,"course_id": string,"created_at"?: string,"explanation"?: string | null,"id"?: string,"lesson_id": string,"options": NonNullable<Json>,"position"?: number,"prompt": string
                  }
                  Update: {
                    "correct_index"?: number,"course_id"?: string,"created_at"?: string,"explanation"?: string | null,"id"?: string,"lesson_id"?: string,"options"?: NonNullable<Json>,"position"?: number,"prompt"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "quiz_questions_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quiz_questions_lesson_id_fkey"
      columns: ["lesson_id"]
isOneToOne: false
      referencedRelation: "lessons"
      referencedColumns: ["id"]
    }
                  ]
                },"refunds": {
                  Row: {
                    "amount_cents": number,"created_at": string,"created_by": string | null,"id": string,"order_id": string,"provider_refund_id": string | null,"reason": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_cents": number,"created_at"?: string,"created_by"?: string | null,"id"?: string,"order_id": string,"provider_refund_id"?: string | null,"reason"?: string | null,"status"?: string
                  }
                  Update: {
                    "amount_cents"?: number,"created_at"?: string,"created_by"?: string | null,"id"?: string,"order_id"?: string,"provider_refund_id"?: string | null,"reason"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "refunds_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "refunds_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"reviews": {
                  Row: {
                    "comment": string | null,"course_id": string,"created_at": string,"id": string,"rating": number,"status": Database["public"]['Enums']["review_status"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "comment"?: string | null,"course_id": string,"created_at"?: string,"id"?: string,"rating": number,"status"?: Database["public"]['Enums']["review_status"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "comment"?: string | null,"course_id"?: string,"created_at"?: string,"id"?: string,"rating"?: number,"status"?: Database["public"]['Enums']["review_status"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reviews_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "academy_public_stats":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_dashboard_stats":
{ Args: { "p_days"?: number,"p_tz"?: string }; Returns: Json
                           },
"admin_grant_course":
{ Args: { "p_course_id": string,"p_user_id": string }; Returns: undefined
                           },
"admin_revenue_by_product":
{ Args: { "p_from"?: string,"p_to"?: string }; Returns: {
              "currency": string,"discount_cents": number,"gross_cents": number,"item_type": string,"net_cents": number,"orders": number,"product_id": string,"refunded_cents": number,"slug": string,"title": string,"units": number
            }[]
                           },
"admin_revoke_course":
{ Args: { "p_course_id": string,"p_user_id": string }; Returns: undefined
                           },
"admin_set_role":
{ Args: { "p_role": Database["public"]['Enums']["user_role"],"p_user_id": string }; Returns: undefined
                           },
"can_view_lesson":
{ Args: { "p_lesson_id": string }; Returns: boolean
                           },
"course_reviews":
{ Args: { "p_course_id": string,"p_limit"?: number,"p_offset"?: number }; Returns: {
              "author_avatar": string,"author_name": string,"comment": string,"created_at": string,"id": string,"rating": number
            }[]
                           },
"display_name":
{ Args: { "p_email": string,"p_full_name": string }; Returns: string
                           },
"enroll_free_course":
{ Args: { "p_course_id": string }; Returns: string
                           },
"featured_reviews":
{ Args: { "p_limit"?: number }; Returns: {
              "author_avatar": string,"author_name": string,"comment": string,"course_slug": string,"course_title": string,"created_at": string,"id": string,"rating": number
            }[]
                           },
"fulfill_order":
{ Args: { "p_amount_cents": number,"p_currency": string,"p_order_id": string,"p_provider_payment_id": string }; Returns: boolean
                           },
"generate_certificate_code":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"get_certificate_public":
{ Args: { "p_code": string }; Returns: {
              "code": string,"completed_at": string,"course_slug": string,"course_title": string,"instructor_name": string,"issued_at": string,"revoked_at": string,"student_name": string
            }[]
                           },
"get_quiz":
{ Args: { "p_lesson_id": string }; Returns: {
              "id": string,"options": Json,"position": number,"prompt": string
            }[]
                           },
"grant_course_from_order":
{ Args: { "p_course_id": string,"p_order_id": string,"p_user_id": string }; Returns: undefined
                           },
"has_course_access":
{ Args: { "p_course_id": string }; Returns: boolean
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"issue_certificate":
{ Args: { "p_completed_at": string,"p_course_id": string,"p_user_id": string }; Returns: undefined
                           },
"lesson_captions_text":
{ Args: { "p_vtt": string }; Returns: string
                           },
"lesson_search_document":
{ Args: { "p_body": string,"p_captions": string,"p_summary": string,"p_title": string }; Returns: unknown
                           },
"lesson_search_query":
{ Args: { "p_q": string }; Returns: unknown
                           },
"lesson_search_terms":
{ Args: { "p_q": string }; Returns: (string)[]
                           },
"lesson_search_text":
{ Args: { "p": string }; Returns: string
                           },
"record_refund":
{ Args: { "p_actor": string,"p_amount_cents": number,"p_order_id": string,"p_provider_refund_id": string,"p_reason": string }; Returns: Database["public"]['Enums']["order_status"]
                           },
"refresh_course_lesson_stats":
{ Args: { "p_course_id": string }; Returns: undefined
                           },
"search_courses":
{ Args: { "p_category"?: string,"p_level"?: Database["public"]['Enums']["course_level"],"p_max_price_cents"?: number,"p_price"?: string,"p_query"?: string,"p_sort"?: string }; Returns: {
              "category_id": string | null,
"compare_at_price_cents": number | null,
"cover_url": string | null,
"created_at": string,
"currency": string,
"description": string,
"duration_minutes": number,
"id": string,
"instructor_id": string | null,
"is_featured": boolean,
"is_free": boolean | null,
"language": string,
"lessons_count": number,
"level": Database["public"]['Enums']["course_level"],
"price_cents": number,
"promo_video_url": string | null,
"published_at": string | null,
"rating_avg": number,
"rating_count": number,
"requirements": (string)[],
"slug": string,
"status": Database["public"]['Enums']["publish_status"],
"students_count": number,
"subtitle": string | null,
"target_audience": (string)[],
"title": string,
"updated_at": string,
"what_you_will_learn": (string)[]
            }[]
                          SetofOptions: {
        from: "*"
        to: "courses"
        isOneToOne: false
        isSetofReturn: true
      } },
"search_lessons":
{ Args: { "p_course_id"?: string,"p_limit"?: number,"q": string }; Returns: {
              "course_id": string,"course_slug": string,"course_title": string,"lesson_id": string,"lesson_title": string,"lesson_type": Database["public"]['Enums']["lesson_type"],"module_title": string,"rank": number,"snippet": string
            }[]
                           },
"submit_quiz_attempt":
{ Args: { "p_answers": Json,"p_lesson_id": string }; Returns: Json
                           }
          }
          Enums: {
            "course_level": "beginner"|"intermediate"|"advanced"|"all","discount_type": "percent"|"fixed","email_status": "sent"|"failed"|"skipped","enrollment_source": "purchase"|"free"|"admin_grant","item_type": "course"|"bundle","lesson_type": "video"|"article"|"quiz"|"exercise","order_status": "pending"|"paid"|"failed"|"cancelled"|"expired"|"refunded"|"partially_refunded","payment_provider": "stripe"|"mercadopago"|"paypal"|"free","publish_status": "draft"|"published"|"archived","review_status": "published"|"hidden","user_role": "student"|"instructor"|"admin","video_provider": "storage"|"youtube"|"vimeo"|"url"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "course_level": ["beginner", "intermediate", "advanced", "all"],"discount_type": ["percent", "fixed"],"email_status": ["sent", "failed", "skipped"],"enrollment_source": ["purchase", "free", "admin_grant"],"item_type": ["course", "bundle"],"lesson_type": ["video", "article", "quiz", "exercise"],"order_status": ["pending", "paid", "failed", "cancelled", "expired", "refunded", "partially_refunded"],"payment_provider": ["stripe", "mercadopago", "paypal", "free"],"publish_status": ["draft", "published", "archived"],"review_status": ["published", "hidden"],"user_role": ["student", "instructor", "admin"],"video_provider": ["storage", "youtube", "vimeo", "url"]
          }
        }
} as const
